import { Set as ImmSet } from "immutable";
import expect from "expect";

const DisputerParams = artifacts.require("DisputerParams");

contract("DisputerParams", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];

  it("can deploy", async () => {
    await DisputerParams.new();
  });

  it("can hash something", async () => {
    const lib = await DisputerParams.new();
    const hashed = await lib.hashParams(0, 0, [], true);
    console.log(hashed);
  });

  const hash = async (...a) => {
    const lib = await DisputerParams.new();
    return await lib.hashParams(...a);
  };

  it("Hash is consistent upon multiple invocations", async () => {
    const h1 = await hash(43, 465, [45, 7], false);
    const h2 = await hash(43, 465, [45, 7], false);
    expect(h1).toEqual(h2);
  });

  it("Doesn't have obvious collisions", async () => {
    const lib = await DisputerParams.new();

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
