import { Set as ImmSet } from "immutable";
import expect from "expect";

const AccountingFactory = artifacts.require("AccountingFactory");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");
const CrowdsourcerFactory = artifacts.require("CrowdsourcerFactory");

contract("CrowdsourcerFactory", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];
  const Bob = accounts[2];

  it("can deploy", async () => {
    const accountingFactory = await AccountingFactory.new();
    const disputerFactory = await MockDisputerFactory.new(Alice, 0, 0);
    await CrowdsourcerFactory.new(
      accountingFactory.address,
      disputerFactory.address,
      Bob
    );
  });

  it("can hash something", async () => {
    const accountingFactory = await AccountingFactory.new();
    const disputerFactory = await MockDisputerFactory.new(Alice, 0, 0);
    const lib = await CrowdsourcerFactory.new(
      accountingFactory.address,
      disputerFactory.address,
      Bob
    );
    const hashed = await lib.hashParams(0, 0, [], true);
  });

  const hash = async (...a) => {
    const accountingFactory = await AccountingFactory.new();
    const disputerFactory = await MockDisputerFactory.new(Alice, 0, 0);
    const lib = await CrowdsourcerFactory.new(
      accountingFactory.address,
      disputerFactory.address,
      Bob
    );
    return await lib.hashParams(...a);
  };

  it("Hash is consistent upon multiple invocations", async () => {
    const h1 = await hash(43, 465, [45, 7], false);
    const h2 = await hash(43, 465, [45, 7], false);
    expect(h1).toEqual(h2);
  });

  it("Doesn't have obvious collisions", async () => {
    // do various mutations for each subsequent row, that may uncover poorly
    // implemented hashing algorithm
    const examples = [
      [43, 465, [45, 7], false],
      [44, 465, [45, 7], false],
      [44, 466, [45, 7], false],
      [44, 466, [46, 7], false],
      [44, 466, [46, 8], false],
      [44, 466, [46, 8], true],
      [44, 466, [8, 46], true],
      [466, 44, [8, 46], true],
      [466, 44, [0, 8, 46], true],
      [466, 44, [0, 8, 46, 0], true]
    ];

    const hashes = await Promise.all(
      examples.map(async row => await hash(...row))
    );

    expect(ImmSet(hashes).size).toEqual(examples.length);
  });
});
