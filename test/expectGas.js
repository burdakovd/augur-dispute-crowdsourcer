import expect from "expect";
import Web3 from "web3";

/**
 * We sometimes want to test gas to run certain transaction, however
 * during test coverage runs gas is different, so we will flip the test
 * for those cases
 */
function expectGas(web3, gasPromiseIsh) {
  return {
    resolves: {
      toBe: async expected => {
        const realGas = await Promise.resolve().then(() => gasPromiseIsh);
        const w3 = new Web3(web3.currentProvider);
        const block = await w3.eth.getBlock("latest");
        if (block.gasLimit < 100000000) {
          expect(realGas).toBe(expected);
        }
      }
    }
  };
}

export default expectGas;
