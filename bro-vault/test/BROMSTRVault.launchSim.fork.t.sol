// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";

/// @notice Black-box diagnostic: replays the exact `newTokenV6WithVault` call
///         Flap's frontend makes for a BRO launch against our real, deployed
///         BROMSTRVaultBeaconFactory, on a live mainnet fork.
///
///         `VAULT_PORTAL_LAUNCH` (0x8B4329947e34B6d56D71A3385caC122BaDe7d78D),
///         the contract `newTokenV6WithVault` delegatecalls into, is NOT
///         publicly verified. This simulation was the only way to observe its
///         actual behavior. Root cause found empirically (no guessing):
///
///           - `mktBps == 0`             -> reverts `InvalidMktBps()` (0x2b1599db)
///             *before* our factory or vault code ever runs. Confirmed real:
///             the selector is present in VAULT_PORTAL_LAUNCH's own deployed
///             bytecode and resolves via openchain.xyz's signature database.
///           - `mktBps` nonzero but != 10_000 (e.g. 100, 500) -> passes that
///             check and reaches OUR factory's `onBeforeLaunch`, which
///             correctly reverts with our own readable string ("BRO MSTR
///             Vault requires 100% of tax revenue..."). This proves the
///             normalized `LaunchValidationDataV1.vaultBps` field the real
///             VaultPortal passes to `onBeforeLaunch` equals `mktBps`
///             *verbatim* -- Flap's real code redirects the "marketing" bps
///             recipient to the vault for custom-vault launches, it does not
///             compute `10_000 - mktBps`.
///           - `mktBps == 10_000` (deflation/dividend/lp bps == 0) -> passes
///             `InvalidMktBps()` AND passes our factory's `vaultBps == 10_000`
///             check silently (no revert from our factory), landing on
///             `InvalidVanity(address)` (0x7576ca0a) instead -- Flap's
///             ordinary vanity-suffix salt-mining requirement that applies to
///             every Flap token launch and is already handled by Flap's own
///             frontend, unrelated to our custom vault factory.
///
///         CONCLUSION: our deployed factory
///         (0x963311e32cd50BCBF99990467B8C5354Ba05017d) is correct and needs
///         no changes or redeployment. The real launch must be attempted with
///         Flap's "Marketing" tax-allocation slider set to 100% (not 0%) --
///         it is the field that gets redirected to the custom vault, not a
///         separate "Vault %" field -- while the native Dividend/Burn/
///         Liquidity sliders stay at 0%, exactly as before.
///
///         This test does not assert eventual success (vanity-salt mining is
///         Flap's frontend's job, not this factory's) -- it asserts the exact
///         revert selector at each `mktBps` value so this diagnosis is
///         reproducible and regresses loudly if Flap's launch contract ever
///         changes shape. Nothing here is broadcast; `vm.createSelectFork` +
///         a plain `call` never leave the fork.
contract LaunchSimForkTest is Test {
    address internal constant RH_VAULT_PORTAL = 0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B;
    address internal constant OUR_FACTORY = 0x963311e32cd50BCBF99990467B8C5354Ba05017d;
    address internal constant DEPLOYER = 0x7DE1877a329849badfb200aC3BC84f9C9e86c70B;

    // --- IPortalTypes enum mirrors (must match real IPortal.sol ordinal values) ---
    enum DexThreshType {
        TWO_THIRDS,
        FOUR_FIFTHS,
        HALF,
        _95_PERCENT,
        _81_PERCENT,
        _1_PERCENT
    }

    enum MigratorType {
        V3_MIGRATOR,
        V2_MIGRATOR,
        V4_UNI_MIGRATOR,
        PCS_INFINITY_CL_MIGRATOR
    }

    enum V3LPFeeProfile {
        LP_FEE_PROFILE_STANDARD,
        LP_FEE_PROFILE_LOW,
        LP_FEE_PROFILE_HIGH
    }

    enum DEXId {
        DEX0,
        DEX1,
        DEX2
    }

    enum TokenVersion {
        TOKEN_LEGACY_MINT_NO_PERMIT,
        TOKEN_LEGACY_MINT_NO_PERMIT_DUPLICATE,
        TOKEN_V2_PERMIT,
        TOKEN_GOPLUS,
        TOKEN_TAXED,
        TOKEN_TAXED_V2,
        TOKEN_TAXED_V3,
        TOKEN_V3_PERMIT
    }

    struct NewTokenV6WithVaultParams {
        string name;
        string symbol;
        string meta;
        DexThreshType dexThresh;
        bytes32 salt;
        MigratorType migratorType;
        address quoteToken;
        uint256 quoteAmt;
        bytes permitData;
        bytes32 extensionID;
        bytes extensionData;
        DEXId dexId;
        V3LPFeeProfile lpFeeProfile;
        uint16 buyTaxRate;
        uint16 sellTaxRate;
        uint64 taxDuration;
        uint64 antiFarmerDuration;
        uint16 mktBps;
        uint16 deflationBps;
        uint16 dividendBps;
        uint16 lpBps;
        uint256 minimumShareBalance;
        address dividendToken;
        address commissionReceiver;
        TokenVersion tokenVersion;
        address vaultFactory;
        bytes vaultData;
    }

    function setUp() public {
        string memory rpcUrl = vm.envOr("ROBINHOOD_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com"));
        vm.createSelectFork(rpcUrl);
    }

    bytes4 internal constant SEL_INVALID_MKT_BPS = 0x2b1599db; // InvalidMktBps()
    bytes4 internal constant SEL_INVALID_VANITY = 0x7576ca0a; // InvalidVanity(address)
    bytes4 internal constant SEL_ERROR_STRING = 0x08c379a0; // Error(string)

    /// @notice mktBps == 0 ("Marketing" slider at 0%) reverts InvalidMktBps()
    ///         before our factory or vault code ever runs -- this is the real
    ///         root cause of the reported launch failure.
    function test_mktBpsZero_revertsInvalidMktBps_beforeOurFactoryRuns() public {
        (bytes4 selector,) = _simulate(bytes32(0), 0);
        assertEq(selector, SEL_INVALID_MKT_BPS, "expected Flap's own InvalidMktBps() at mktBps=0");
    }

    /// @notice A nonzero-but-partial mktBps passes Flap's own check and reaches
    ///         our factory's onBeforeLaunch, which correctly rejects it -- proof
    ///         that the normalized vaultBps equals mktBps verbatim, not (10000 - mktBps).
    function test_mktBpsPartial_reachesOurFactory_andIsCorrectlyRejected() public {
        (bytes4 selector, bytes memory body) = _simulate(bytes32(0), 500);
        assertEq(selector, SEL_ERROR_STRING, "expected to reach our factory's onBeforeLaunch revert");
        string memory reason = abi.decode(body, (string));
        assertEq(
            reason,
            "BRO MSTR Vault requires 100% of tax revenue to be allocated to the vault.",
            "expected our own factory's exact rejection string"
        );
    }

    /// @notice mktBps == 10_000 ("Marketing" slider at 100%) passes InvalidMktBps()
    ///         AND passes our factory's vaultBps == 10_000 check silently -- the
    ///         next revert (InvalidVanity) is Flap's ordinary salt-mining
    ///         requirement for every token launch, unrelated to our factory.
    function test_mktBps10000_passesOurFactory_hitsOrdinaryVanityCheck() public {
        (bytes4 selector,) = _simulate(bytes32(0), 10_000);
        assertEq(selector, SEL_INVALID_VANITY, "expected to pass our factory and hit Flap's own vanity-salt check");
    }

    function _simulate(bytes32 salt, uint16 mktBps) internal returns (bytes4 selector, bytes memory body) {
        assertGt(OUR_FACTORY.code.length, 0, "our factory must be live");
        assertGt(RH_VAULT_PORTAL.code.length, 0, "VaultPortal proxy must be live");

        NewTokenV6WithVaultParams memory params = NewTokenV6WithVaultParams({
            name: "BRO",
            symbol: "BRO",
            meta: "",
            dexThresh: DexThreshType.FOUR_FIFTHS,
            salt: salt,
            migratorType: MigratorType.V2_MIGRATOR,
            quoteToken: address(0),
            quoteAmt: 0,
            permitData: "",
            extensionID: bytes32(0),
            extensionData: "",
            dexId: DEXId.DEX0,
            lpFeeProfile: V3LPFeeProfile.LP_FEE_PROFILE_STANDARD,
            buyTaxRate: 100,
            sellTaxRate: 100,
            taxDuration: 30 days,
            antiFarmerDuration: 0,
            mktBps: mktBps,
            deflationBps: 0,
            dividendBps: 0,
            lpBps: 0,
            minimumShareBalance: 0,
            dividendToken: address(0),
            commissionReceiver: address(0),
            tokenVersion: TokenVersion.TOKEN_TAXED_V3,
            vaultFactory: OUR_FACTORY,
            vaultData: abi.encode(0xec262a75e413fAfD0dF80480274532C79D42da09, "BRO", true)
        });

        bytes memory callData = abi.encodeWithSignature(
            "newTokenV6WithVault((string,string,string,uint8,bytes32,uint8,address,uint256,bytes,bytes32,bytes,uint8,uint8,uint16,uint16,uint64,uint64,uint16,uint16,uint16,uint16,uint256,address,address,uint8,address,bytes))",
            params
        );

        vm.deal(DEPLOYER, 10 ether);
        vm.prank(DEPLOYER);
        (bool success, bytes memory ret) = RH_VAULT_PORTAL.call{value: 0}(callData);

        assertFalse(success, "expected a revert -- vanity salt is never mined in this diagnostic");
        require(ret.length >= 4, "revert returned no selector");

        assembly {
            selector := mload(add(ret, 32))
        }

        if (ret.length > 4) {
            body = new bytes(ret.length - 4);
            for (uint256 i = 0; i < body.length; i++) {
                body[i] = ret[i + 4];
            }
        }

        console2.log("mktBps:", mktBps);
        console2.logBytes4(selector);
    }
}
