// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {VaultFactoryBaseV2} from "./flap/VaultFactoryBaseV2.sol";
import {IVaultFactoryValidationV2} from "./flap/IVaultFactory.sol";
import {VaultDataSchema, FieldDescriptor} from "./flap/IVaultSchemasV1.sol";
import {BeaconProxy} from "@openzeppelin/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/proxy/beacon/UpgradeableBeacon.sol";
import {BROMSTRVaultUpgradeable} from "./BROMSTRVault.sol";

/// @title BROMSTRVaultBeaconFactory
/// @notice Beacon-backed factory that creates BROMSTRVaultUpgradeable
///         instances, restricted to a registry of supported reward assets
///         (initially just MSTR).
///
/// @dev ASSET REGISTRY DESIGN
///      The brief calls for "additional supported tokenized stocks can be
///      added only through an explicitly defined governance/admin
///      mechanism if the Flap specification permits it." The Flap V2
///      factory spec doesn't define a standard registry-extension
///      mechanism of its own — factories are free-form beyond the required
///      interface — so this uses a simple Guardian-gated allowlist, which
///      is consistent with the Guardian-mandate pattern used everywhere
///      else in the V2 spec (see VaultFactoryBaseV2's NatSpec).
///
///      For the BRO production configuration specifically, this factory's
///      `newVault` additionally hard-enforces that the launch selects
///      *exactly* MSTR at 100% — even though the registry could technically
///      hold more than one supported asset in the future, BRO's own vaults
///      cannot be created with anything else. This satisfies "for the BRO
///      production configuration, MSTR must be the only selected asset and
///      receive 100% allocation" as a hard constraint, not just a default.
contract BROMSTRVaultBeaconFactory is VaultFactoryBaseV2 {
    // ========== IMMUTABLE ==========
    address public immutable beacon;
    /// @notice The only reward asset a BRO vault may ever select.
    address public immutable MSTR;

    // ========== SUPPORTED ASSET REGISTRY ==========
    mapping(address => bool) public isSupportedAsset;
    address[] private _supportedAssetList;

    // ========== OPERATIONAL CONFIG (applied to vaults this factory creates) ==========
    address public defaultMstrSwapAdapter;
    address public defaultLiquidityAdapter;
    address public defaultBurnSwapAdapter;
    address public defaultKeeper;

    // ========== EVENTS ==========
    event AssetRegistered(address indexed asset);
    event AssetDeregistered(address indexed asset);
    event DefaultMstrSwapAdapterUpdated(address indexed adapter);
    event DefaultLiquidityAdapterUpdated(address indexed adapter);
    event DefaultBurnSwapAdapterUpdated(address indexed adapter);
    event DefaultKeeperUpdated(address indexed keeper);
    event VaultCreated(address indexed taxToken, address indexed vault, address mstrAsset);

    /// @param _mstr                  MSTR Stock Token address. VERIFY INDEPENDENTLY before
    ///                               deployment -- see README.
    /// @param _defaultMstrSwapAdapter Initial IMSTRSwapAdapter address for the ETH->MSTR
    ///                               dividend leg (can be address(0) and set later by
    ///                               Guardian; vaults will simply be unable to
    ///                               dispatchDividend() until one is configured).
    /// @param _defaultLiquidityAdapter Initial ILiquidityAdapter address for the
    ///                               auto-liquidity leg (can be address(0), same caveat).
    /// @param _defaultBurnSwapAdapter Initial IMSTRSwapAdapter address (reused generically)
    ///                               for the ETH->BRO buy-and-burn leg (can be address(0),
    ///                               same caveat).
    /// @param _defaultKeeper         Initial keeper address for vaults this factory creates.
    constructor(
        address _mstr,
        address _defaultMstrSwapAdapter,
        address _defaultLiquidityAdapter,
        address _defaultBurnSwapAdapter,
        address _defaultKeeper
    ) {
        require(_mstr != address(0), "Zero address");

        MSTR = _mstr;
        isSupportedAsset[_mstr] = true;
        _supportedAssetList.push(_mstr);
        emit AssetRegistered(_mstr);

        defaultMstrSwapAdapter = _defaultMstrSwapAdapter;
        defaultLiquidityAdapter = _defaultLiquidityAdapter;
        defaultBurnSwapAdapter = _defaultBurnSwapAdapter;
        defaultKeeper = _defaultKeeper;

        BROMSTRVaultUpgradeable impl = new BROMSTRVaultUpgradeable();
        beacon = address(new UpgradeableBeacon(address(impl)));
    }

    // ========== GUARDIAN: ASSET REGISTRY ==========

    /// @notice Register an additional supported asset. Guardian-only.
    /// @dev    Does NOT retroactively affect BRO's own vaults, which hard-code
    ///         MSTR regardless of what else is in the registry -- see contract
    ///         NatSpec. This exists for forward compatibility if this factory
    ///         is ever reused as a template for a non-BRO-specific deployment.
    function registerAsset(address asset) external {
        require(msg.sender == _getGuardian(), "Not guardian");
        require(asset != address(0), "Zero address");
        require(!isSupportedAsset[asset], "Already registered");

        isSupportedAsset[asset] = true;
        _supportedAssetList.push(asset);
        emit AssetRegistered(asset);
    }

    function deregisterAsset(address asset) external {
        require(msg.sender == _getGuardian(), "Not guardian");
        require(asset != MSTR, "Cannot deregister MSTR");
        require(isSupportedAsset[asset], "Not registered");

        isSupportedAsset[asset] = false;
        emit AssetDeregistered(asset);
        // Note: _supportedAssetList is left with a stale entry deliberately --
        // use supportedAssets() (below) which filters live status, rather than
        // mutating array storage on every deregister.
    }

    function supportedAssets() external view returns (address[] memory active) {
        uint256 count;
        for (uint256 i = 0; i < _supportedAssetList.length; i++) {
            if (isSupportedAsset[_supportedAssetList[i]]) count++;
        }
        active = new address[](count);
        uint256 j;
        for (uint256 i = 0; i < _supportedAssetList.length; i++) {
            address a = _supportedAssetList[i];
            if (isSupportedAsset[a]) {
                active[j] = a;
                j++;
            }
        }
    }

    // ========== GUARDIAN: OPERATIONAL DEFAULTS ==========

    function setDefaultMstrSwapAdapter(address adapter) external {
        require(msg.sender == _getGuardian(), "Not guardian");
        defaultMstrSwapAdapter = adapter;
        emit DefaultMstrSwapAdapterUpdated(adapter);
    }

    function setDefaultLiquidityAdapter(address adapter) external {
        require(msg.sender == _getGuardian(), "Not guardian");
        defaultLiquidityAdapter = adapter;
        emit DefaultLiquidityAdapterUpdated(adapter);
    }

    function setDefaultBurnSwapAdapter(address adapter) external {
        require(msg.sender == _getGuardian(), "Not guardian");
        defaultBurnSwapAdapter = adapter;
        emit DefaultBurnSwapAdapterUpdated(adapter);
    }

    function setDefaultKeeper(address keeper_) external {
        require(msg.sender == _getGuardian(), "Not guardian");
        defaultKeeper = keeper_;
        emit DefaultKeeperUpdated(keeper_);
    }

    // ========== VAULT UPGRADE MANAGEMENT (per Flap's recommended beacon pattern) ==========

    function upgradeVaultImplementation(address newImplementation) external {
        require(msg.sender == _getGuardian(), "Only Guardian");
        UpgradeableBeacon(beacon).upgradeTo(newImplementation);
    }

    /// @notice Permanently locks the beacon so no future implementation
    ///         upgrades are possible. Irreversible.
    function lockVaultUpgrades() external {
        require(msg.sender == _getGuardian(), "Only Guardian");
        UpgradeableBeacon(beacon).renounceOwnership();
    }

    function isVaultUpgradesLocked() external view returns (bool) {
        return UpgradeableBeacon(beacon).owner() == address(0);
    }

    function beaconImplementation() external view returns (address) {
        return UpgradeableBeacon(beacon).implementation();
    }

    // ========== IVaultFactory ==========

    /// @notice Deploy and initialize a new BRO MSTR vault.
    /// @dev    vaultData = abi.encode(address selectedAsset, string symbol, bool instantDividend)
    ///         per the schema in `vaultDataSchema()`. For BRO's production
    ///         configuration, `selectedAsset` MUST be exactly `MSTR`.
    ///
    ///         `selectedAsset` is a single `address`, not an `address[]`: Flap's
    ///         schema spec (see IVaultSchemasV1.sol) only supports scalar field
    ///         types for UI-driven form encoding, not array-typed leaf fields.
    function newVault(address taxToken, address quoteToken, address, /* creator */ bytes calldata vaultData)
        external
        override
        returns (address vault)
    {
        require(msg.sender == _getVaultPortal(), "Only vault portal");
        require(taxToken != address(0), "Zero address");
        require(isQuoteTokenSupported(quoteToken), "Unsupported quote token");

        (address selectedAsset,, bool instantDividend) = _decodeVaultData(vaultData);

        _validateSelectedAsset(selectedAsset);

        vault = address(
            new BeaconProxy(
                beacon,
                abi.encodeCall(
                    BROMSTRVaultUpgradeable.initialize,
                    (
                        taxToken,
                        selectedAsset,
                        defaultMstrSwapAdapter,
                        defaultLiquidityAdapter,
                        defaultBurnSwapAdapter,
                        defaultKeeper,
                        instantDividend,
                        0 // minSwapThresholdWei -- Guardian can raise this post-deploy via setMinSwapThreshold
                    )
                )
            )
        );

        emit VaultCreated(taxToken, vault, selectedAsset);
    }

    /// @notice Decode `vaultData`, tolerating a known Flap launch-UI bug that
    ///         double-ABI-encodes it.
    /// @dev    Confirmed on live Robinhood Chain mainnet: some Flap frontend builds
    ///         wrap the correctly-encoded `abi.encode(selectedAsset, symbol,
    ///         instantDividend)` in an extra outer `abi.encode(bytes)`, prepending a
    ///         spurious 32-byte `0x20` offset word. Decoding that directly as
    ///         `(address, string, bool)` reads the real `selectedAsset` address as a
    ///         `string` offset instead, which is wildly out of bounds and makes
    ///         `abi.decode` revert with no reason string -- surfacing to the end
    ///         user as an unexplained, unrecognized launch failure.
    ///
    ///         A correctly-encoded `selectedAsset` can never equal exactly `32`
    ///         (that would require MSTR's real deployed address to be
    ///         `0x0000...0020`, which it is not, and `_validateSelectedAsset` would
    ///         reject any other address here regardless) -- so reading the first
    ///         word as `32` is an unambiguous signal that one extra `bytes` layer
    ///         needs to be stripped before decoding the real fields.
    function _decodeVaultData(bytes calldata vaultData)
        internal
        pure
        returns (address selectedAsset, string memory symbol, bool instantDividend)
    {
        bytes memory payload = vaultData;
        if (vaultData.length >= 32 && uint256(bytes32(vaultData[0:32])) == 32) {
            payload = abi.decode(vaultData, (bytes));
        }
        (selectedAsset, symbol, instantDividend) = abi.decode(payload, (address, string, bool));
    }

    function _validateSelectedAsset(address selectedAsset) internal view {
        require(selectedAsset != address(0), "Zero address");
        require(isSupportedAsset[selectedAsset], "Unsupported asset");

        // BRO-specific hard constraint: exactly the constructor-verified MSTR
        // asset. Do not infer this from registry ordering: the registry is an
        // administrative convenience, whereas the BRO asset is immutable.
        require(selectedAsset == MSTR, "Only MSTR supported for BRO");
    }

    function isQuoteTokenSupported(address quoteToken) public pure override returns (bool supported) {
        // BRO tax revenue arrives as native ETH.
        supported = quoteToken == address(0);
    }

    function _validateBeforeLaunch(IVaultFactoryValidationV2.LaunchValidationDataV1 memory data)
        internal
        pure
        override
        returns (bool success, string memory reason)
    {
        if (data.quoteToken != address(0)) {
            return (false, "BRO MSTR Vault requires native ETH as the quote token.");
        }
        // Flap's vault/market allocation is the ETH stream received by this
        // vault. `dividendBps` instead routes native dividends through Flap's
        // separate dividend processor, which is not this vault's MSTR flow.
        // `deflationBps`/`lpBps` are Flap's OWN native burn/auto-liquidity
        // mechanisms; they must stay at zero because this vault implements
        // its own 80/15/5 dividend/liquidity/burn split internally instead.
        if (data.vaultBps != 10_000) {
            return (false, "BRO MSTR Vault requires 100% of tax revenue to be allocated to the vault.");
        }
        if (data.deflationBps != 0 || data.dividendBps != 0 || data.lpBps != 0) {
            return (false, "BRO MSTR Vault requires zero deflation, native-dividend, and LP tax allocations.");
        }
        return (true, "");
    }

    function vaultDataSchema() public pure override returns (VaultDataSchema memory schema) {
        schema.description =
            "Creates a BRO MSTR Vault. selectedAsset must be exactly MSTR -- this factory rejects any other configuration. symbol is informational. instantDividend selects push-to-holder (true) vs. claim-based (false) distribution UX.";
        schema.fields = new FieldDescriptor[](3);
        schema.fields[0] = FieldDescriptor("selectedAsset", "address", "Reward asset -- must be exactly MSTR", 0);
        schema.fields[1] = FieldDescriptor("symbol", "string", "Informational token symbol", 0);
        schema.fields[2] = FieldDescriptor("instantDividend", "bool", "true = push MSTR directly to holders", 0);
        schema.isArray = false;
    }
}
