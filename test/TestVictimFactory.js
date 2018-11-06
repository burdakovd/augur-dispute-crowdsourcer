const VictimFactory = artifacts.require("VictimFactory");

contract("VictimFactory", accounts => {
  it("can deploy", async () => {
    await VictimFactory.new(0, 0);
  });
});
