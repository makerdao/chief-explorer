import React, { Component } from 'react';
import './App.css';
import web3, { initWeb3 } from './web3';
import ReactNotify from './notify';
import { printNumber, etherscanTx, etherscanAddress, etherscanToken } from './helpers';
import logo from './makerdao.svg';

var dschief = require('./abi/dschief.json');
var dstoken = require('./abi/dstoken.json');
var dsspell = require('./abi/dsspell.json');
var settings = require('./settings.json');
var chiefContract = web3.eth.contract(dschief.abi);
var tokenContract = web3.eth.contract(dstoken.abi);
var spellContract = web3.eth.contract(dsspell.abi);
window.dschief = dschief;
window.dstoken = dstoken;
window.chiefContract = chiefContract;
window.tokenContract = tokenContract;
window.spellContract = spellContract;
window.l = console.log;

class App extends Component {
  constructor() {
    super();
    const initialState = this.getInitialState();
    this.state = {
      ...initialState,
      transactions: {},
      network: {},
    }
  }

  getInitialState = () => {
    return {
      gov: null,
      iou: null,
      chief: null,
      slates: [],
      candidates: {},
      loaded: false,
      myVote: null,
      GOVBalance: web3.toBigNumber(-1),
      GOVAllowance: web3.toBigNumber(-1),
      IOUBalance: web3.toBigNumber(-1),
      IOUAllowance: web3.toBigNumber(-1),
      max_yays: web3.toBigNumber(-1),
      hat: null,
      hatSpell: {}
    };
  }

  checkNetwork = () => {
    web3.version.getNode((error) => {
      const isConnected = !error;

      // Check if we are synced
      if (isConnected) {
        web3.eth.getBlock('latest', (e, res) => {
          if (typeof(res) === 'undefined') {
            console.debug('YIKES! getBlock returned undefined!');
          }
          if (res.number >= this.state.network.latestBlock) {
            const networkState = { ...this.state.network };
            networkState['latestBlock'] = res.number;
            networkState['outOfSync'] = e != null || ((new Date().getTime() / 1000) - res.timestamp) > 600;
            this.setState({ network: networkState });
          } else {
            // XXX MetaMask frequently returns old blocks
            // https://github.com/MetaMask/metamask-plugin/issues/504
            console.debug('Skipping old block');
          }
        });
      }

      // Check which network are we connected to
      // https://github.com/ethereum/meteor-dapp-wallet/blob/90ad8148d042ef7c28610115e97acfa6449442e3/app/client/lib/ethereum/walletInterface.js#L32-L46
      if (this.state.network.isConnected !== isConnected) {
        if (isConnected === true) {
          web3.eth.getBlock(0, (e, res) => {
            let network = false;
            if (!e) {
              switch (res.hash) {
                case '0xa3c565fc15c7478862d50ccd6561e3c06b24cc509bf388941c25ea985ce32cb9':
                  network = 'kovan';
                  break;
                case '0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3':
                  network = 'main';
                  break;
                default:
                  console.log('setting network to private');
                  console.log('res.hash:', res.hash);
                  network = 'private';
              }
            }
            if (this.state.network.network !== network) {
              this.initNetwork(network);
            }
          });
        } else {
          const networkState = { ...this.state.network };
          networkState['isConnected'] = isConnected;
          networkState['network'] = false;
          networkState['latestBlock'] = 0;
          this.setState({ network: networkState });
        }
      }
    });
  }

  initNetwork = (newNetwork) => {
    //checkAccounts();
    const networkState = { ...this.state.network };
    networkState['network'] = newNetwork;
    networkState['isConnected'] = true;
    networkState['latestBlock'] = 0;
    this.setState({ network: networkState }, () => {
      this.initContract();
    });
  }

  checkAccounts = () => {
    web3.eth.getAccounts((error, accounts) => {
      if (!error) {
        const networkState = { ...this.state.network };
        networkState['accounts'] = accounts;
        networkState['defaultAccount'] = accounts[0];
        web3.eth.defaultAccount = networkState['defaultAccount'];
        this.setState({ network: networkState }, () => {
          if (web3.isAddress(this.state.network.defaultAccount)) {
            web3.eth.getBalance(this.state.network.defaultAccount, (e, r) => {
              const networkState = { ...this.state.network };
              networkState['accountBalance'] = r;
              this.setState({ network: networkState });
            });
          }
        });
      }
    });
  }

  componentDidMount() {
    setTimeout(() => {
      initWeb3(web3).then(() => {
        window.web3 = web3;
        this.checkNetwork();
        this.checkAccounts();
        this.checkAccountsInterval = setInterval(this.checkAccounts, 10000);
        this.checkNetworkInterval = setInterval(this.checkNetwork, 3000);
      }, e => {
        alert(e);
      });
    }, 500);
  }

  initContract = () => {
    web3.reset(true);
    const initialState = this.getInitialState();
    this.setState({
      ...initialState
    }, async () => {
      const chief = this.state.network.network === 'main' ?
        settings.chain[this.state.network.network].chief :
        (window.localStorage.getItem('chief') || settings.chain[this.state.network.network].chief);
      if (chief  && web3.isAddress(chief)) {
        window.chiefObj = this.chiefObj = chiefContract.at(chief);
        const gov = await this.getToken('GOV');
        const iou = await this.getToken('IOU');
        if (gov && iou && web3.isAddress(gov) && web3.isAddress(iou)) {
          window.govObj = this.govObj = tokenContract.at(gov);
          window.iouObj = this.iouObj = tokenContract.at(iou);
          this.getGOVBalance();
          this.getGOVAllowance();
          this.getIOUBalance();
          this.getIOUAllowance();
          this.getMyVote();
          this.getMaxYays();
          this.getHat();
          this.setState({ gov, iou, chief }, () => {
            this.getSlates().then(() => {
              this.chiefObj.LogNote({ sig: [this.methodSig('etch(address[])'), this.methodSig('vote(address[])')] }, { fromBlock: 'latest' }, (e, r) => {
                this.extractSlateAddresses(r);
                this.getMyVote();
              });
            });
          });
          this.chiefObj.LogNote({ sig: this.methodSig('lift(address)') }, { fromBlock: 'latest' }, (e, r) => {
            this.getHat();
            this.logTransactionConfirmed(r.transactionHash);
          });
          this.chiefObj.LogNote({ sig: this.methodSig('vote(bytes32)') }, { fromBlock: 'latest' }, (e, r) => {
            this.getMyVote();
            this.reloadApprovals();
            this.logTransactionConfirmed(r.transactionHash);
          });
          this.chiefObj.LogNote({ sig: [this.methodSig('lock(uint128)'), this.methodSig('free(uint128)')] }, { fromBlock: 'latest' }, (e, r) => {
            this.getIOUBalance();
            this.getIOUAllowance();
            this.reloadApprovals();
          });
          this.govObj.LogNote({ sig: [this.methodSig('transfer(address,uint256)'),
                                      this.methodSig('transferFrom(address,address,uint256)'),
                                      this.methodSig('approve(address,uint256)'),
                                      this.methodSig('push(address,uint128)'),
                                      this.methodSig('pull(address,uint128)'),
                                      this.methodSig('mint(uint128)'),
                                      this.methodSig('burn(uint128)')] }, { fromBlock: 'latest' }, (e, r) => {
            this.getGOVBalance();
            this.getGOVAllowance();
            this.logTransactionConfirmed(r.transactionHash);
          });
          this.iouObj.LogNote({ sig: this.methodSig('approve(address,uint256)') }, { fromBlock: 'latest' }, (e, r) => {
            this.getIOUAllowance();
            this.logTransactionConfirmed(r.transactionHash);
          });
          // This is necessary to finish transactions that failed after signing
          this.checkPendingTransactionsInterval = setInterval(this.checkPendingTransactions, 10000);
        }
      }
    });
  }

  _getSlates = () => {
    return new Promise((resolve, reject) => {
      web3.eth.getBlock('latest', async (e, r) => {
        if (e) console.log("failed to fetch block number");
        else {
          const latestBlock = r.number;
          const blockGap = 10000;
          const blocksToFetch = [];
          for (let fromBlock = 0; fromBlock < latestBlock; fromBlock += (blockGap + 1)) {
            blocksToFetch.push([fromBlock, fromBlock + blockGap]);
          }
          const _slates = await Promise.all(blocksToFetch.map(([fromBlock, toBlock]) =>
            new Promise((resolve, reject) => {
              this.chiefObj.LogNote({ sig: [this.methodSig('etch(address[])'), this.methodSig('vote(address[])')] }, { fromBlock, toBlock }).get(async (e, r) => {
                if (e) reject(e);
                resolve(r);
              });
            })
          )).catch(e => reject(e));
          resolve(_slates.flat());
        }
      })
    })
  }

  getSlates = () => {
    return new Promise((resolve, reject) => {
      this._getSlates().then(async r => {
        const candidates = {};
        const slates = {};
        for (let i = 0; i < r.length; i++) {
          this.extractSlateAddresses(r[i], candidates, slates);
        }
        this.getMyVote();
        await this.getApprovals(candidates);
        this.setState(() => {
          return {candidates, slates, loaded: true}
        }, () => {
          resolve(true);
        });
      }).catch(reject);
    });
  }

  extractSlateAddresses = (data, candidates, slates) => {
    const addressesString = data.args.fax.substring(data.args.sig === this.methodSig('vote(address[],address)') ? 202 : 138);
    const addresses = [];
    let slateHashAddress = '';
    for (let i = 0; i < addressesString.length / 64; i++) {
      const address = `0x${addressesString.substring(i * 64 + 24, (i + 1) * 64)}`;
      candidates[address] = typeof candidates[address] !== 'undefined' ? candidates[address] : web3.toBigNumber(0);
      addresses.push(address);
      slateHashAddress += addressesString.substring(i * 64, (i + 1) * 64);
    }
    slates[web3.sha3(slateHashAddress, { encoding: 'hex' })] = addresses;
    return { candidates, slates };
  }

  methodSig = (method) => {
    return web3.sha3(method).substring(0, 10)
  }

  getContractABIFromEtherscan = address => {
    return new Promise((resolve, reject) => {
      const url = `https://api${this.state.network.network !== 'main' ? `-${this.state.network.network}` : ''}.etherscan.io/api?module=contract&action=getabi&address=${address}`;
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } else if (xhr.readyState === 4 && xhr.status !== 200) {
          reject(xhr.status);
        }
      }
      xhr.send();
    })
  }

  executeCallback = args => {
    const method = args.shift();
    this[method](...args);
  }

  // Transactions
  checkPendingTransactions = () => {
    const transactions = { ...this.state.transactions };
    Object.keys(transactions).map(tx => {
      if (transactions[tx].pending) {
        web3.eth.getTransactionReceipt(tx, (e, r) => {
          if (!e && r !== null) {
            if (r.logs.length === 0) {
              this.logTransactionFailed(tx);
            } else if (r.blockNumber)  {
              this.logTransactionConfirmed(tx);
            }
          }
        });
      }
      return false;
    });
  }

  logRequestTransaction = (id, title) => {
    const msgTemp = 'Waiting for transaction signature...';
    this.refs.notificator.info(id, title, msgTemp, false);
  }

  logPendingTransaction = (id, tx, title, callback = []) => {
    const msgTemp = 'Transaction TX was created. Waiting for confirmation...';
    const transactions = { ...this.state.transactions };
    transactions[tx] = { pending: true, title, callback }
    this.setState({ transactions });
    console.log(msgTemp.replace('TX', tx));
    this.refs.notificator.hideNotification(id);
    this.refs.notificator.info(tx, title, etherscanTx(this.state.network.network, msgTemp.replace('TX', `${tx.substring(0,10)}...`), tx), false);
  }

  logTransactionConfirmed = tx => {
    const msgTemp = 'Transaction TX was confirmed.';
    const transactions = { ...this.state.transactions };
    if (transactions[tx] && transactions[tx].pending) {
      transactions[tx].pending = false;
      this.setState({ transactions }, () => {
        console.log(msgTemp.replace('TX', tx));
        this.refs.notificator.hideNotification(tx);
        this.refs.notificator.success(tx, transactions[tx].title, etherscanTx(this.state.network.network, msgTemp.replace('TX', `${tx.substring(0,10)}...`), tx), 4000);
        if (transactions[tx].callback.length > 0) {
          this.executeCallback(transactions[tx].callback);
        }
      });
    }
  }

  logTransactionFailed = tx => {
    const msgTemp = 'Transaction TX failed.';
    const transactions = { ...this.state.transactions };
    if (transactions[tx]) {
      transactions[tx].pending = false;
      this.setState({ transactions });
      this.refs.notificator.error(tx, transactions[tx].title, msgTemp.replace('TX', `${tx.substring(0,10)}...`), 4000);
    }
  }

  logTransactionRejected = (tx, title) => {
    const msgTemp = 'User denied transaction signature.';
    this.refs.notificator.error(tx, title, msgTemp, 4000);
  }
  //

  // Getters
  getToken = (token) => {
    return new Promise((resolve, reject) => {
      this.chiefObj[token]((e, r) => {
        if (!e) {
          resolve(r);
        } else {
          reject(e);
        }
      });
    })
  }

  getApproval = (candidate) => {
    return new Promise((resolve, reject) => {
      this.chiefObj.approvals(candidate, (e, r) => {
        if (!e) {
          resolve(r);
        } else {
          reject(e);
        }
      });
    })
  }

  getApprovals = (candidates) => {
    return new Promise(resolve => {
      const promises = [];
      Object.keys(candidates).map(key => promises.push(this.getApproval(key)));
      Promise.all(promises).then(r => {
        let i = 0;
        Object.keys(candidates).map(key => {
          candidates[key] = r[i];
          i ++;
          return true;
        });
        resolve(true);
      });
    });
  }

  getGOVBalance = () => {
    this.govObj.balanceOf(this.state.network.defaultAccount, (e, r) => {
      if (!e) {
        this.setState({ GOVBalance: r })
      }
    });
  }

  getGOVAllowance = () => {
    this.govObj.allowance(this.state.network.defaultAccount, this.chiefObj.address, (e, r) => {
      if (!e) {
        this.setState({ GOVAllowance: r })
      }
    });
  }

  getIOUBalance = () => {
    this.chiefObj.deposits(this.state.network.defaultAccount, (e, r) => {
      if (!e) {
        this.setState({ IOUBalance: r })
      }
    });
  }

  getIOUAllowance = () => {
    this.iouObj.allowance(this.state.network.defaultAccount, this.chiefObj.address, (e, r) => {
      if (!e) {
        this.setState({ IOUAllowance: r })
      }
    });
  }

  reloadBalances = () => {
    this.getGOVBalance();
    this.getIOUBalance();
  }

  reloadApprovals = () => {
    const candidates = { ...this.state.candidates };
    this.getApprovals(candidates);
    this.setState({ candidates });
  }

  reloadVotes = () => {
    this.getMyVote();
    this.reloadApprovals();
  }

  getMyVote = () => {
    this.chiefObj.votes(this.state.network.defaultAccount, (e, r) => {
      if (!e) {
        this.setState({ myVote: r })
      }
    });
  }

  getMaxYays = () => {
    this.chiefObj.MAX_YAYS((e, r) => {
      if (!e) {
        this.setState({ max_yays: r })
      }
    });
  }

  getValueHatSpell = (field) => {
    return new Promise((resolve, reject) => {
      spellContract.at(this.state.hat)[field]((e, r) => {
        if (!e) {
          resolve(r);
        } else {
          reject(e);
        }
      });
    });
  }

  getHat = () => {
    this.chiefObj.hat((e, r) => {
      if (!e) {
        this.setState({ hat: r, hatSpell: {} }, () => {
          const promises = [this.getValueHatSpell('whom'), this.getValueHatSpell('mana'), this.getValueHatSpell('data'), this.getValueHatSpell('done')];
          Promise.all(promises).then(r2 => {
            if (web3.isAddress(r2[0])) {
              Promise.resolve(this.getContractABIFromEtherscan(r2[0])).then(r3 => {
                const sig = r2[2].substring(0, 10);
                let abi = [];
                JSON.parse(r3.result).forEach(value => {
                  if (this.methodSig(`${value.name}(${value.inputs.map(val => val.type).join(',')})`) === sig) {
                    abi = value;
                  }
                });
                this.setState({ hatSpell: { 'whom': r2[0], 'mana': r2[1], 'data': r2[2], 'done': r2[3], 'abi': abi } });
              });
            }
          }, e => {});
        })
      }
    });
  }
  //

  // Actions
  loadCustomChief = (e) => {
    e.preventDefault();
    const chief = this.chiefAddress.value;
    if (chief && web3.isAddress(chief)) {
      try {
        // Reset form value
        this.chiefAddress.value = null;
        window.localStorage.setItem('chief', chief);
        this.initContract();
      } catch (e) {
        console.log(e);
      }
    }
  }

  clearCustomChief = (e) => {
    window.localStorage.setItem('chief', '');
    this.initContract();
  }

  deploy = async (e) => {
    e.preventDefault();
    if (this.max_yays.value) {
      try {
        const gov = this.govAddress.value && web3.isAddress(this.govAddress.value)
                    ? this.govAddress.value
                    : await this.deployToken('0x474f560000000000000000000000000000000000000000000000000000000000'); // symbol = GOV
        console.log('GOV:', gov);
        const iou = await this.deployToken('0x494f550000000000000000000000000000000000000000000000000000000000'); // symbol = IOU
        console.log('IOU:', iou);
        const chief = await this.deployChief(gov, iou, this.max_yays.value);
        console.log('Chief:', chief);
        if (gov && iou && chief && web3.isAddress(gov) && web3.isAddress(iou) && web3.isAddress(chief)) {
          this.setOwnership(iou, chief);
          window.localStorage.setItem('chief', chief);
          // Reset form values
          this.govAddress.value = null;
          this.max_yays.value = null;
          this.initContract();
        }
      } catch (e) {
        console.log(e);
      }
    }
  }

  checkDeployedAddress = (resolve, reject, tx) => {
    // We need to use an interval as MM with filters are not a good combination
    this.checkDeployAddress = setInterval(() => {
      web3.eth.getTransactionReceipt(tx.transactionHash, (e, r) => {
        if (!e) {
          if (r && r.contractAddress) {
            clearInterval(this.checkDeployAddress);
            this.logTransactionConfirmed(tx.transactionHash);
            resolve(r.contractAddress);
          }
        } else {
          reject(e);
        }
      });
    }, 5000);
  }

  deployToken = (symbol) => {
    return new Promise((resolve, reject) => {
      const id = Math.random();
      const title = `deploy: ${web3.toAscii(symbol)}`;
      this.logRequestTransaction(id, title);
      tokenContract.new(symbol, { data: dstoken.bytecode, gas: 2000000 }, (e, tx) => {
        if (!e) {
          this.logPendingTransaction(id, tx.transactionHash, title);
          this.checkDeployedAddress(resolve, reject, tx);
        } else {
          this.logTransactionRejected(id, title);
          reject(e);
        }
      });
    })
  }

  deployChief = (gov, iou, max) => {
    return new Promise((resolve, reject) => {
      const id = Math.random();
      const title = 'deploy: chief';
      this.logRequestTransaction(id, title);
      chiefContract.new(gov, iou, max, { data: dschief.bytecode, gas: 2000000 }, (e, tx) => {
        if (!e) {
          this.logPendingTransaction(id, tx.transactionHash, title);
          this.checkDeployedAddress(resolve, reject, tx);
        } else {
          this.logTransactionRejected(id, title);
          reject(e);
        }
      });
    })
  }

  setOwnership = (iou, chief) => {
    return new Promise((resolve, reject) => {
      const id = Math.random();
      const title = 'IOU setOwner Chief';
      this.logRequestTransaction(id, title);
      tokenContract.at(iou).setOwner(chief, (e, tx) => {
        if (!e) {
          this.logPendingTransaction(id, tx, title);
          resolve(tx);
        } else {
          reject(e);
        }
      });
    })
  }

  setAllowance = (e) => {
    e.preventDefault();
    const token = e.target.getAttribute('data-token');
    const value = e.target.getAttribute('data-value');
    const id = Math.random();
    const title = `${token} ${value === "0" ? 'deny' : 'rely'} chief`;
    this.logRequestTransaction(id, title);
    this[`${token}Obj`].approve(this.chiefObj.address, value, (e, tx) => {
      if (!e) {
        this.logPendingTransaction(id, tx, title, [`get${token.toUpperCase()}Allowance`]);
      } else {
        this.logTransactionRejected(id, title);
      }
    });
    return false;
  }

  lockFree = (e) => {
    e.preventDefault();
    const method = this.methodLF.value;
    const value = web3.toWei(this.amount.value);
    if (method === 'lock' && this.state.GOVBalance.lt(value)) {
      alert('Not enough GOV balance to lock this amount');
    } else if (method === 'lock' && this.state.GOVAllowance.lt(value)) {
      alert('Not allowance set for GOV Token');
    } else if (method === 'free' && this.state.IOUBalance.lt(value)) {
      alert('Not enough IOU balance (GOV locked) to free this amount');
    } else if (method === 'free' && this.state.IOUAllowance.lt(value)) {
      alert('Not allowance set for IOU Token');
    } else {
      const id = Math.random();
      const title = `${method}: ${this.amount.value}`;
      this.logRequestTransaction(id, title);
      this.chiefObj[method](value, (e, tx) => {
        this.logPendingTransaction(id, tx, title, ['reloadBalances']);
        // Reset form value
        this.amount.value = null;
      });
    }
    return false;
  }

  voteSlate = (e) => {
    e.preventDefault();
    const slate = e.target.getAttribute('data-slate');
    const id = Math.random();
    const title = `vote: ${slate}`;
    this.logRequestTransaction(id, title);
    this.chiefObj.vote.bytes32(slate, (e, tx) => {
      this.logPendingTransaction(id, tx, title, ['reloadVotes']);
    });
    return false;
  }

  createSlate = (e) => {
    e.preventDefault();
    const method = this.methodVE.value;
    const addresses = this.addresses.value.replace(/\s/g,'').split(',').sort();
    const id = Math.random();
    const title = `${method}: ${addresses.join(',')}`;
    this.logRequestTransaction(id, title);
    this.chiefObj[method]['address[]'](addresses, (e, tx) => {
      this.logPendingTransaction(id, tx, title, ['getSlates']);
      // Reset form value
      this.addresses.value = null;
    });
    return false;
  }

  liftCandidate = (e) => {
    e.preventDefault();
    const address = e.target.getAttribute('data-address');
    const id = Math.random();
    const title = `lift: ${address}`;
    this.logRequestTransaction(id, title);
    this.chiefObj.lift(address, (e, tx) => {
      this.logPendingTransaction(id, tx, title, ['getHat']);
    });
    return false;
  }
  //

  renderChiefData = () => {
    const hatSpellParams = [];
    if (this.state.hatSpell.abi) {
      let i = 0;
      this.state.hatSpell.abi.inputs.forEach(input => {
        let val = this.state.hatSpell.data.substring(10 + i * 64, 10 + (i + 1) * 64);
        switch(input.type) {
          case 'uint256':
          case 'uint128':
          case 'uint64':
          case 'uint32':
          case 'uint16':
          case 'uint8':
            val = web3.toBigNumber(`0x${val}`).valueOf();
            break;
          case 'string':
            val = web3.toAscii(`0x${val}`);
            break;
          case 'address':
            val = `0x${val.substring(24, 64)}`;
            break;
          default:
            break;
        }
        hatSpellParams.push({field: input.name, value: val});
        i++;
      });
    }
    return(
      <section>
        <div className="col-md-12">
          <div className="box">
            <div className="box-header with-border">
                <h3 className="box-title">Balances</h3>
              </div>
              <div className="box-body">
                <div className="row">
                  <div className="col-md-12">
                    <table>
                      <thead>
                        <tr>
                          <th></th>
                          <th>Balance</th>
                          <th>Allowance</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>GOV Balance</td>
                          <td>
                            {
                              this.state.GOVBalance.eq(-1)
                              ? 'Loading...'
                              : printNumber(this.state.GOVBalance)
                            }
                          </td>
                          <td>
                            {
                              this.state.GOVAllowance.eq(-1) || this.state.GOVBalance.eq(-1)
                              ? 'Calculating allowance...'
                              :
                                this.state.GOVAllowance.eq(web3.toBigNumber(2).pow(256).minus(1)) // uint(-1))
                                ? 'Approved'
                                : 'Not Approved'
                            }
                          </td>
                          <td>
                            {
                              !this.state.GOVAllowance.eq(-1) && !this.state.GOVBalance.eq(-1) &&
                              this.state.GOVAllowance.eq(web3.toBigNumber(2).pow(256).minus(1)) // uint(-1))
                                ? <a href="#allowance" onClick={ this.setAllowance } data-token="gov" data-value="0">Deny</a>
                                : <a href="#allowance" onClick={ this.setAllowance } data-token="gov" data-value="-1">Rely</a>
                            }
                          </td>
                        </tr>
                        <tr>
                          <td>IOU Balance (Locked GOV)</td>
                          <td>
                            {
                              this.state.IOUBalance.eq(-1)
                              ? 'Loading...'
                              : printNumber(this.state.IOUBalance)
                            }
                          </td>
                          <td>
                            {
                              this.state.IOUAllowance.eq(-1) || this.state.IOUBalance.eq(-1)
                              ? 'Calculating allowance...'
                              :
                                this.state.IOUAllowance.eq(web3.toBigNumber(2).pow(256).minus(1)) // uint(-1))
                                ? 'Approved'
                                : 'Not Approved'
                            }
                          </td>
                          <td>
                            {
                              !this.state.IOUAllowance.eq(-1) && !this.state.IOUBalance.eq(-1) &&
                              this.state.IOUAllowance.eq(web3.toBigNumber(2).pow(256).minus(1)) // uint(-1))
                                ? <a href="#allowance" onClick={ this.setAllowance } data-token="iou" data-value="0">Deny</a>
                                : <a href="#allowance" onClick={ this.setAllowance } data-token="iou" data-value="-1">Rely</a>
                            }
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-12">
          <div className="box">
            <div className="box-header with-border">
                <h3 className="box-title">Lock/Free GOV</h3>
              </div>
              <div className="box-body">
                <div className="row">
                  <div className="col-md-12">
                    <form ref={ (input) => this.lockFreeForm = input } onSubmit={ e => this.lockFree(e) }>
                      <input ref={ (input) => this.amount = input } type="number" placeholder="Amount to be locked/freed" style={ {width: '200px'} }/>
                      <select ref={ (input) => this.methodLF = input } >
                        <option value="lock">Lock</option>
                        <option value="free">Free</option>
                      </select>
                      <input type="submit" />
                    </form>
                  </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-12">
          <div className="box">
            <div className="box-header with-border">
                <h3 className="box-title">Candidates Ranking</h3>
              </div>
              <div className="box-body">
                <div className="row">
                  <div className="col-md-12">
                    <p>Hat: { etherscanAddress(this.state.network.network, this.state.hat, this.state.hat) }</p>
                    {
                      Object.keys(this.state.hatSpell).length > 0 &&
                      <table style={ { marginBottom: '15px' } }>
                        <tbody>
                          <tr>
                            <td>Target</td>
                            <td>{ etherscanAddress(this.state.network.network, this.state.hatSpell.whom, this.state.hatSpell.whom) }</td>
                          </tr>
                          <tr>
                            <td>Data</td>
                            <td>
                              { this.state.hatSpell.data.substring(0, 10) }<br />
                              { this.state.hatSpell.data.substring(10, this.state.hatSpell.data.length) }
                            </td>
                          </tr>
                          {
                            this.state.hatSpell.abi &&
                            <tr>
                              <td>Sig</td>
                              <td>
                                {`${this.state.hatSpell.abi.name}(${this.state.hatSpell.abi.inputs.map(val => `${val.type} ${val.name}`).join(', ')})`}
                              </td>
                            </tr>
                          }
                          {
                            hatSpellParams.length > 0 &&
                            <tr>
                              <td>Params</td>
                              <td>
                                {
                                  hatSpellParams.map(input =>
                                    <p key={ input.field }>
                                      { input.field }: { input.value }
                                    </p>
                                  )
                                }
                              </td>
                            </tr>
                          }
                          <tr>
                            <td>Value</td>
                            <td>{ printNumber(this.state.hatSpell.mana) }</td>
                          </tr>
                          <tr>
                            <td>Executed</td>
                            <td>{ this.state.hatSpell.done ? 'Yes' : 'No' }</td>
                          </tr>
                        </tbody>
                      </table>
                    }
                    {
                      this.state.loaded
                      ?
                        Object.keys(this.state.candidates).length > 0
                        ?
                          <table>
                            <thead>
                              <tr>
                                <th>
                                  Candidate
                                </th>
                                <th>
                                  Weight
                                </th>
                                <th>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                            {
                              Object.keys(this.state.candidates).sort((a,b) => this.state.candidates[b] - this.state.candidates[a]).map(key =>
                                <tr key={ key }>
                                  <td>{ etherscanAddress(this.state.network.network, key, key) }</td>
                                  <td style={ {textAlign: 'right'} }>{ printNumber(this.state.candidates[key]) }</td>
                                  <td>{ typeof this.state.candidates[this.state.hat] === 'undefined' || this.state.candidates[key].gt(this.state.candidates[this.state.hat]) ? <a href="#lift" data-address={ key } onClick={ this.liftCandidate }>Lift this candidate</a> : <span style={ {color:'#d2d6de'} }>Lift this candidate</span> }</td>
                                </tr>
                              )
                            }
                            </tbody>
                          </table>
                        :
                          <div>No candidates...</div>
                      :
                        "Loading..."
                    }
                  </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-12">
          <div className="box">
            <div className="box-header with-border">
                <h3 className="box-title">Slates Created</h3>
              </div>
              <div className="box-body">
                <div className="row">
                  <div className="col-md-12">
                    {
                      this.state.loaded
                      ?
                        Object.keys(this.state.candidates).length > 0
                        ?
                          <table>
                            <thead>
                              <tr>
                                <th>
                                  Slate
                                </th>
                                <th>
                                  Addresses
                                </th>
                                <th>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {
                                Object.keys(this.state.slates).map(key =>
                                  <tr key={ key }>
                                    <td>
                                      <span title={key}>{ key.substring(0,20) }...</span>
                                    </td>
                                    <td>
                                      {
                                        this.state.slates[key].map(value => <p key={ value }>{ etherscanAddress(this.state.network.network, value, value) }</p>)
                                      }
                                    </td>
                                    <td>
                                      {
                                        this.state.myVote === key
                                        ? 'Voted'
                                        : <a data-slate={ key } href="#vote" onClick={ this.voteSlate }>Vote this</a>
                                      }
                                    </td>
                                  </tr>
                                )
                              }
                            </tbody>
                          </table>
                        :
                          <div>No slates created...</div>
                      :
                        "Loading..."
                    }
                  </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-12">
          <div className="box">
            <div className="box-header with-border">
                <h3 className="box-title">New slate</h3>
              </div>
              <div className="box-body">
                <div className="row">
                  <div className="col-md-12">
                    <form ref={ (input) => this.createSlateForm = input } onSubmit={ e => this.createSlate(e) }>
                      <input ref={ (input) => this.addresses = input } type="text" placeholder="Add addresses (comma separated)" style={ {width: '200px'} }/>
                      <select ref={ (input) => this.methodVE = input } >
                        <option value="vote">Create and vote</option>
                        <option value="etch">Just create</option>
                      </select>
                      <input type="submit" />
                    </form>
                  </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  render() {
    return (
      <div className="content-wrapper">
        <section className="content-header">
          <h1>
            <a href="/" className="logo"><img src={ logo } alt="Chief Explorer" width="50" /> - Chief Explorer</a>
          </h1>
        </section>
        <section className="content">
          <div>
            <div className="row">
              <div className="col-md-12">
                <div className="warning-box">
                  <div className="warning-text-wrapper">
                    <h3 className="warning-text"> 
                      <strong style={{fontWeight: "bold"}}> Warning </strong> 
                      <br /> 
                      Potential Risk - This page is used for viewing the current MKR weighting against Governance proposals and has the ability to lock/free user balances. It should be used at the user's own risk.
                    </h3>
                  </div>
                </div>
                <div className="box">
                  <div className="box-header with-border">
                    <h3 className="box-title">General Info</h3>
                  </div>
                  <div className="box-body">
                    <div className="row">
                      <div className="col-md-6">
                        <p>
                          <strong>Network:</strong> { this.state.network.network }<br />
                          <strong>Your account:</strong> { etherscanAddress(this.state.network.network, this.state.network.defaultAccount, this.state.network.defaultAccount) }<br />
                          <strong>Chief:</strong> { etherscanAddress(this.state.network.network, this.state.chief, this.state.chief) }<br />
                          <strong>GOV Token:</strong> { etherscanToken(this.state.network.network, this.state.gov, this.state.gov) }<br />
                          <strong>IOU Token:</strong> { etherscanToken(this.state.network.network, this.state.iou, this.state.iou) }<br />
                          <strong>Max yays:</strong> { this.state.max_yays.eq(-1) ? 'Loading...' : this.state.max_yays.valueOf() }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {
                this.state.network.network !== 'main' &&
                <div className="col-md-6">
                  <div className="box">
                    <div className="box-header with-border">
                        <h3 className="box-title">Create new Chief</h3>
                      </div>
                      <div className="box-body">
                        <div className="row">
                          <div className="col-md-12">
                            <span>
                              <p>If GOV address remains empty or is not a valid address, it will deploy a test token</p>
                              <form ref={ input => this.deployForm = input } onSubmit={ e => this.deploy(e) }>
                                <input ref={ input => this.govAddress = input } name="gov" type="text" placeholder="GOV Token Address" />
                                <input ref={ input => this.max_yays = input } name="max_yays" type="text" placeholder="Max yays" />
                                <input type="submit"/>
                              </form>
                            </span>
                          </div>
                      </div>
                    </div>
                  </div>
                </div>
              }
              {
                this.state.network.network !== 'main' &&
                <div className="col-md-6">
                  <div className="box">
                    <div className="box-header with-border">
                      <h3 className="box-title">Load { this.state.chief ? 'another ': '' }Chief contract</h3>
                    </div>
                    <div className="box-body">
                      <div className="row">
                        <div className="col-md-12">
                          <span>
                            <form ref={ input => this.loadForm = input } onSubmit={ e => this.loadCustomChief(e) }>
                              <input ref={ input => this.chiefAddress = input } name="chief" type="text" placeholder="Chief address" />
                              <input type="submit" />
                              {
                                window.localStorage.getItem('chief') &&
                                <span>
                                  &nbsp;
                                  <button type="button" onClick={e => this.clearCustomChief(e)}>Use default contract</button>
                                </span>
                              }
                            </form>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              }
              {
                this.state.chief
                ? this.renderChiefData()
                : ''
              }
              <hr />
              <ReactNotify ref='notificator'/>
            </div>
          </div>
        </section>
      </div>
    );
  }
}

export default App;
