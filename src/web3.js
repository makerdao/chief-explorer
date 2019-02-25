import Web3 from 'web3';

const web3 = new Web3();

export default web3;

const initWeb3 = async web3 => {
  return new Promise(async (resolve, reject) => {
    try {
      if (window.web3 || window.ethereum) {
        if (window.ethereum) {
          await window.ethereum.enable();
          web3.setProvider(window.ethereum);
        } else {
          web3.setProvider(window.web3.currentProvider);
        }
      } else {
        web3.setProvider(new Web3.providers.HttpProvider('http://localhost:8545'));
      }
      window.web3 = web3;
      resolve(true);
    } catch (e) {
      reject(e);
    }
  });
}

export { initWeb3 };
