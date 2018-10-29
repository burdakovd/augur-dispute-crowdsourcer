import expect from "expect";
import invariant from "invariant";

/**
 * We can't rest real disputer easily as it requires deploying all Augur
 * contracts, so we test mock version of it. This version inherits most of the
 * same code via BaseDisputer, and overrides just a little bit.
 *
 * The code that is only in MockDisputer will not have automated test coverage
 * for now, so will need to be tested on mainnet
 * (or via more sophisticated test suites).
 */

const IDisputer = artifacts.require("IDisputer");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");
const IERC20 = artifacts.require(
  "openzeppelin-solidity/contracts/token/ERC20/IERC20"
);

function onlyx(a) {
  invariant(a.length === 1, `Must have one element, got ${a.length}`);
  return a[0];
}

contract("MockDisputer", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];
  const Bob = accounts[2];
  const Eve = accounts[3];
  const John = accounts[4];

  const MAX_UINT256 =
    "115792089237316195423570985008687907853269984665640564039457584007913129639935";
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const create_test_disputer = async (
    addressToSendABunchOfREPTo,
    amountOfREP,
    amountOfRepToUseForDispute
  ) => {
    const factory = await MockDisputerFactory.new(
      addressToSendABunchOfREPTo,
      amountOfREP,
      amountOfRepToUseForDispute
    );
    await factory.prepareMocks();
    const event = await factory
      .create(Eve, 0, 0, [], false)
      .then(receipt => onlyx(receipt.logs).args);
    return IDisputer.at(event._address);
  };

  it("can create instance of disputer", async () => {
    await create_test_disputer(Bob, 0, 0);
  });

  it("knows owner", async () => {
    const disputer = await create_test_disputer(Bob, 0, 0);
    await expect(disputer.getOwner()).resolves.toEqual(Eve);
  });

  it("has correct initial state", async () => {
    const disputer = await create_test_disputer(Bob, 110, 30);
    // check all state we can see from public methods after construction
    await expect(disputer.getOwner()).resolves.toEqual(Eve);
    await expect(disputer.hasDisputed()).resolves.toEqual(false);
    await expect(disputer.feeReceiver()).resolves.toEqual(ZERO_ADDRESS);
    const rep = await disputer.getREP().then(address => IERC20.at(address));
    await expect(rep.totalSupply().then(s => s.toNumber())).resolves.toBe(110);

    await expect(rep.balanceOf(Bob).then(s => s.toNumber())).resolves.toBe(110);

    await expect(() => disputer.baseInit()).rejects;

    await expect(
      rep.allowance(disputer.address, Eve).then(s => s.toFixed())
    ).resolves.toBe(MAX_UINT256);
  });

  it("can perform dispute token ERC20 approval", async () => {
    const disputer = await create_test_disputer(Bob, 110, 0);

    await disputer.dispute(Alice);

    const disputeToken = await disputer
      .getDisputeTokenAddress()
      .then(address => IERC20.at(address));

    await expect(
      disputeToken.allowance(disputer.address, Eve).then(s => s.toFixed())
    ).resolves.toBe("0");

    await disputer.approveManagerToSpendDisputeTokens();

    await expect(
      disputeToken.allowance(disputer.address, Eve).then(s => s.toFixed())
    ).resolves.toBe(MAX_UINT256);
  });

  it("can do actual dispute, and has good state after", async () => {
    const disputer = await create_test_disputer(Bob, 110, 30);
    const rep = await disputer.getREP().then(address => IERC20.at(address));

    await expect(disputer.hasDisputed()).resolves.toEqual(false);

    await rep.transfer(disputer.address, 80, { from: Bob });

    await expect(
      rep.balanceOf(disputer.address).then(s => s.toNumber())
    ).resolves.toBe(80);

    await disputer.dispute(Alice);

    const disputeToken = await disputer
      .getDisputeTokenAddress()
      .then(address => IERC20.at(address));

    await expect(
      rep.balanceOf(disputer.address).then(s => s.toNumber())
    ).resolves.toBe(50);
    await expect(
      disputeToken.balanceOf(disputer.address).then(s => s.toNumber())
    ).resolves.toBe(30);

    await expect(disputer.hasDisputed()).resolves.toEqual(true);
    await expect(disputer.feeReceiver()).resolves.toEqual(Alice);
  });

  it("cannot do dispute with zero address", async () => {
    const disputer = await create_test_disputer(Bob, 110, 30);
    const rep = await disputer.getREP().then(address => IERC20.at(address));
    await rep.transfer(disputer.address, 80, { from: Bob });
    await expect(disputer.dispute(ZERO_ADDRESS)).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("cannot do dispute twice", async () => {
    const disputer = await create_test_disputer(Bob, 110, 30);
    const rep = await disputer.getREP().then(address => IERC20.at(address));
    await rep.transfer(disputer.address, 80, { from: Bob });
    await disputer.dispute(Alice);
    await expect(disputer.dispute(Alice)).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("cannot do dispute twice, even from different accounts", async () => {
    const disputer = await create_test_disputer(Bob, 110, 30);
    const rep = await disputer.getREP().then(address => IERC20.at(address));
    await rep.transfer(disputer.address, 80, { from: Bob });
    await disputer.dispute(Alice);
    await expect(disputer.dispute(John)).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });
});
