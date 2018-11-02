import expect from "expect";

/**
 * We sometimes want to test gas to run certain transaction, however
 * during test coverage runs gas is different, so we will flip the test
 * for those cases
 */
function expectGas(gasIsh) {
  const expectation = expect(gasIsh);
  return web3.version.network === "coverage" ? expectation.not : expectation;
}
