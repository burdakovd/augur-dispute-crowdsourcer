import expect from "expect";

const Notary = artifacts.require("Notary");

contract("Notary", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];

  it("can deploy", async () => {
    await Notary.new();
  });

  it("not hacked initially", async () => {
    const notary = await Notary.new();
    await expect(notary.isHacked()).resolves.toBe(false);
  });

  it("stranger cannot report", async () => {
    const notary = await Notary.new();
    await expect(notary.reportHacked({ from: Alice })).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("owner can report", async () => {
    const notary = await Notary.new();
    await notary.reportHacked({ from: Manager });
    await expect(notary.isHacked()).resolves.toBe(true);
  });

  it("cannot report twice", async () => {
    const notary = await Notary.new();
    await notary.reportHacked({ from: Manager });
    await expect(notary.reportHacked({ from: Manager })).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });
});
