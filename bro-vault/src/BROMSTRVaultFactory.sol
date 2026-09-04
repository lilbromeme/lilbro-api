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
    // ========== ERRORS ==========
    // Note: ZeroAddress is already declared in IVaultFactory (inherited via
    // VaultFactoryBaseV2) -- reused here rather than redeclared.
    error DuplicateAsset();
    error UnsupportedAsset(address asset);
    error TooManyAssets();
    error NoAssetsSelected();
    error OnlyMSTRSupportedForBRO();
    error AlreadyRegistered();
    error NotRegistered();
    error CannotDeregisterMSTR();

    // ========== CONSTANTS ==========
    uint256 public constant MAX_SELECTED_ASSETS = 1; // BRO vaults are single-asset (MSTR) by design

    // ========== IMMUTABLE ==========
    address public immutable beacon;
    /// @notice The only reward asset a BRO vault may ever select.
    address public immutable MSTR;

    // ========== SUPPORTED ASSET REGISTRY ==========
    mapping(address => bool) public isSupportedAsset;
    address[] private _supportedAssetList;

    // ========== OPERATIONAL CONFIG (applied to vaults this factory creates) ==========
    address public defaultSwapAdapter;
    address public defaultKeeper;
    uint256 public defaultMinSwapThresholdWei;

    // ========== EVENTS ==========
    event AssetRegistered(address indexed asset);
    event AssetDeregistered(address indexed asset);
    event DefaultSwapAdapterUpdated(address indexed adapter);
    event DefaultKeeperUpdated(address indexed keeper);
    event VaultCreated(address indexed taxToken, address indexed vault, address mstrAsset);

    /// @param _mstr             MSTR Stock Token address. VERIFY INDEPENDENTLY before
    ///                          deployment -- see README.
    /// @param _defaultSwapAdapter Initial IMSTRSwapAdapter address (can be address(0)
    ///                          and set later by Guardian; vaults will simply be
    ///                          unable to dispatch() until one is configured).
    /// @param _defaultKeeper    Initial keeper address for vaults this factory creates.
    constructor(address _mstr, address _defaultSwapAdapter, address _defaultKeeper) {
        if (_mstr == address(0)) revert ZeroAddress();

        MSTR = _mstr;
        isSupportedAsset[_mstr] = true;
        _supportedAssetList.push(_mstr);
        emit AssetRegistered(_mstr);

        defaultSwapAdapter = _defaultSwapAdapter;
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
        if (msg.sender != _getGuardian()) revert NotRegistered();
        if (asset == address(0)) revert ZeroAddress();
        if (isSupportedAsset[asset]) revert AlreadyRegistered();

        isSupportedAsset[asset] = true;
        _supportedAssetList.push(asset);
        emit AssetRegistered(asset);
    }

    function deregisterAsset(address asset) external {
        if (msg.sender != _getGuardian()) revert NotRegistered();
        if (asset == MSTR) revert CannotDeregisterMSTR();
        if (!isSupportedAsset[asset]) revert NotRegistered();

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

    function setDefaultSwapAdapter(address adapter) external {
        if (msg.sender != _getGuardian()) revert NotRegistered();
        defaultSwapAdapter = adapter;
        emit DefaultSwapAdapterUpdated(adapter);
    }

    function setDefaultKeeper(address keeper_) external {
        if (msg.sender != _getGuardian()) revert NotRegistered();
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
    /// @dev    vaultData = abi.encode(address[] selectedAssets, string symbol, bool instantDividend)
    ///         per the schema in `vaultDataSchema()`. For BRO's production
    ///         configuration, `selectedAssets` MUST be exactly `[MSTR]`.
    function newVault(address taxToken, address quoteToken, address, /* creator */ bytes calldata vaultData)
        external
        override
        returns (address vault)
    {
        if (msg.sender != _getVaultPortal()) revert OnlyVaultPortal();
        if (taxToken == address(0)) revert ZeroAddress();
        if (!isQuoteTokenSupported(quoteToken)) revert UnsupportedAsset(quoteToken);

        (address[] memory selectedAssets,, bool instantDividend) = abi.decode(vaultData, (address[], string, bool));

        _validateSelectedAssets(selectedAssets);

        vault = address(
            new BeaconProxy(
                beacon,
                abi.encodeCall(
                    BROMSTRVaultUpgradeable.initialize,
                    (
                        taxToken,
                        selectedAssets[0],
                        defaultSwapAdapter,
                        defaultKeeper,
                        instantDividend,
                        0 // minSwapThresholdWei -- Guardian can raise this post-deploy via setMinSwapThreshold
                    )
                )
            )
        );

        emit VaultCreated(taxToken, vault, selectedAssets[0]);
    }

    function _validateSelectedAssets(address[] memory selectedAssets) internal view {
        if (selectedAssets.length == 0) revert NoAssetsSelected();
        if (selectedAssets.length > MAX_SELECTED_ASSETS) revert TooManyAssets();

        // Duplicate check (relevant if MAX_SELECTED_ASSETS is ever raised for
        // a non-BRO deployment reusing this factory as a template).
        for (uint256 i = 0; i < selectedAssets.length; i++) {
            if (selectedAssets[i] == address(0)) revert ZeroAddress();
            if (!isSupportedAsset[selectedAssets[i]]) revert UnsupportedAsset(selectedAssets[i]);
            for (uint256 j = i + 1; j < selectedAssets.length; j++) {
                if (selectedAssets[i] == selectedAssets[j]) revert DuplicateAsset();
            }
        }

        // BRO-specific hard constraint: exactly the constructor-verified MSTR
        // asset. Do not infer this from registry ordering: the registry is an
        // administrative convenience, whereas the BRO asset is immutable.
        if (selectedAssets[0] != MSTR) revert OnlyMSTRSupportedForBRO();
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
            "Creates a BRO MSTR Vault. selectedAssets must be exactly [MSTR] -- this factory rejects any other configuration. symbol is informational. instantDividend selects push-to-holder (true) vs. claim-based (false) distribution UX.";
        schema.fields = new FieldDescriptor[](3);
        schema.fields[0] = FieldDescriptor("selectedAssets", "address[]", "Reward asset(s) -- must be exactly [MSTR]", 0);
        schema.fields[1] = FieldDescriptor("symbol", "string", "Informational token symbol", 0);
        schema.fields[2] = FieldDescriptor("instantDividend", "bool", "true = push MSTR directly to holders", 0);
        schema.isArray = false;
    }
}
