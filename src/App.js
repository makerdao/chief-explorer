import React, { Component } from 'react';
import './App.css';
import Web3 from 'web3';

const web3 = new Web3();

var dschief = require('./config/dschief.json');
var dstoken = require('./config/dstoken.json');
var chiefContract = web3.eth.contract(dschief.abi);
var tokenContract = web3.eth.contract(dstoken.abi);
window.dschief = dschief;
window.dstoken = dstoken;
window.chiefContract = chiefContract;
window.tokenContract = tokenContract;
window.l = console.log;

class App extends Component {
  state = {
    gov: null,
    iou: null,
    chief: null,
    slates: [],
    candidates: {},
    myVote: null,
    GOVBalance: web3.toBigNumber(-1),
    GOVLocked: web3.toBigNumber(-1),
    hat: null,
    account: null
  }

  componentDidMount() {
    setTimeout(() => {
      web3.setProvider(window.web3 ?
        window.web3.currentProvider :
        new Web3.providers.HttpProvider('http://localhost:8545')
      );
      window.web3 = web3;
      web3.eth.getAccounts((e,r) => {
        if (!e) {
          web3.eth.defaultAccount = r[0] || null;
          this.setState({
            account: r[0] || null
          }, () => {
            this.initContract();
          });
        }
      });
    }, 500);
  }

  initContract = () => {
    const gov = window.localStorage.getItem('gov');
    const iou = window.localStorage.getItem('iou');
    const chief = window.localStorage.getItem('chief');
    window.chiefObj = this.chiefObj = chiefContract.at(chief);
    window.govObj = this.govObj = tokenContract.at(gov);
    window.iouObj = this.iouObj = tokenContract.at(iou);
    if (gov && iou && chief && web3.isAddress(gov) && web3.isAddress(iou) && web3.isAddress(chief)) {
      this.getGOVBalance();
      this.getGOVLocked();
      this.getMyVote();
      this.getHat();
      this.setState({ gov, iou, chief }, () => {
        this.chiefObj.LogNote({ sig: [this.methodSig('etch(address[])'), this.methodSig('vote(address[])'), this.methodSig('vote(address[],address)')] }, { fromBlock: 0 }, (e, r) => {
          if (!e) {
            const addressesString = r.args.fax.substring(r.args.sig === this.methodSig('vote(address[],address)') ? 202 : 138);
            this.setState((prevState, props) => {
              const candidates = {...prevState.candidates};
              const slates = {...prevState.slates};
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
            }, () => {
              this.getApprovals();
            });
          }
        });
      });
      this.chiefObj.LogNote({ sig: this.methodSig('lift(address)') }, { fromBlock: 'latest' }, (e, r) => {
        this.getHat();
      });
      this.chiefObj.LogNote({ sig: this.methodSig('vote(bytes32)') }, { fromBlock: 'latest' }, (e, r) => {
        this.getMyVote();
        this.getApprovals();
      });
      this.chiefObj.LogNote({ sig: [this.methodSig('lock(uint128)'), this.methodSig('free(uint128)')] }, { fromBlock: 'latest' }, (e, r) => {
        this.getGOVLocked();
        this.getApprovals();
      });
      this.govObj.LogNote({ sig: [this.methodSig('transfer(address,uint256)'),
                                  this.methodSig('transferFrom(address,address,uint256)'),
                                  this.methodSig('push(address,uint128)'),
                                  this.methodSig('pull(address,uint128)'),
                                  this.methodSig('mint(uint128)'),
                                  this.methodSig('burn(uint128)')] }, { fromBlock: 'latest' }, (e, r) => {
        this.getGOVBalance();
      });
    }
  }

  methodSig = (method) => {
    return web3.sha3(method).substring(0, 10)
  }

  getApprovals = () => {
    Object.keys(this.state.candidates).map(key => {
      this.chiefObj.approvals(key, (e2, r2) => {
        if (!e2) {
          this.setState((prevState, props) => {
            const candidates = {...prevState.candidates};
            candidates[key] = r2;
            return { candidates };
          });
        }
      });
      return false;
    });
  }

  getGOVBalance = () => {
    this.govObj.balanceOf(this.state.account, (e, r) => {
      if (!e) {
        this.setState({ GOVBalance: r })
      }
    });
  }

  getGOVLocked = () => {
    this.chiefObj.deposits(this.state.account, (e, r) => {
      if (!e) {
        this.setState({ GOVLocked: r })
      }
    });
  }

  getMyVote = () => {
    this.chiefObj.votes(this.state.account, (e, r) => {
      if (!e) {
        this.setState({ myVote: r })
      }
    });
  }

  getHat = () => {
    this.chiefObj.hat((e, r) => {
      if (!e) {
        this.setState({ hat: r })
      }
    });
  }

  deploy = async (e) => {
    e.preventDefault();
    if (this.max_yays.value) {
      try {
        const gov = await this.deployToken('0x474f560000000000000000000000000000000000000000000000000000000000'); // symbol = GOV
        console.log('GOV:', gov);
        const iou = await this.deployToken('0x494f550000000000000000000000000000000000000000000000000000000000'); // symbol = IOU
        console.log('IOU:', iou);
        const chief = await this.deployChief(gov, iou, this.max_yays.value);
        console.log('Chief:', chief);
        if (gov && iou && chief && web3.isAddress(gov) && web3.isAddress(iou) && web3.isAddress(chief)) {
          this.setOwnership(iou, chief);
          window.localStorage.setItem('gov', gov);
          window.localStorage.setItem('iou', iou);
          window.localStorage.setItem('chief', chief);
          window.chiefObj = this.chiefObj = chiefContract.at(chief);
          window.govObj = this.govObj = tokenContract.at(gov);
          window.iouObj = this.iouObj = tokenContract.at(iou);
          this.setState({ gov, iou, chief });
        }
      } catch (e) {
        console.log(e);
      }
    }
  }

  doDeploy = (max_yays) => {
    return Promise.resolve(this.deployToken());
  }

  checkDeployedAddress = (resolve, reject, error, tx) => {
    if (!error && tx) {
      web3.eth.getTransactionReceipt(tx.transactionHash, (err, res) => {
        if (!err) {
          if (res && res.contractAddress) {
            resolve(res.contractAddress);
          }
        } else {
          reject(err);
        }
      });
    } else {
      reject(error);
    }
  }

  deployToken = (symbol) => {
    return new Promise((resolve, reject) => {
      tokenContract.new(symbol, { data: dstoken.bytecode, gas: 2000000 }, (error, tx) => {
        this.checkDeployedAddress(resolve, reject, error, tx);
      });
    })
  }

  deployChief = (gov, iou, max) => {
    return new Promise((resolve, reject) => {
      chiefContract.new(gov, iou, max, { data: dschief.bytecode, gas: 2000000 }, (error, tx) => {
        this.checkDeployedAddress(resolve, reject, error, tx);
      });
    })
  }

  setOwnership = (iou, chief) => {
    return new Promise((resolve, reject) => {
      tokenContract.at(iou).setOwner(chief, (error, tx) => {
        if (!error) {
          resolve(tx);
        } else {
          reject(error);
        }
      });
    })
  }

  lockFree = (e) => {
    e.preventDefault();
    const method = this.methodLF.value;
    const amount = web3.toWei(this.amount.value);
    this.chiefObj[method](amount, (e, tx) => {
      console.log(tx);
    });
    return false;
  }

  voteSlate = (e) => {
    e.preventDefault();
    this.chiefObj.vote.bytes32(e.target.getAttribute('data-slate'), (e, tx) => {
      console.log(tx);
    });
    return false;
  }

  createSlate = (e) => {
    e.preventDefault();
    const method = this.methodVE.value;
    const addresses = this.addresses.value.replace(/\s/g,'').split(',').sort();
    this.chiefObj[method]['address[]'](addresses, (e, tx) => {
      console.log(tx);
    });
    return false;
  }

  liftCandidate = (e) => {
    e.preventDefault();
    this.chiefObj.lift(e.target.getAttribute('data-address'), (e, tx) => {
      console.log(tx);
    });
    return false;
  }

  render() {
    return (
      <div className="App">
        <h2>DS Chief</h2>
        <p>Your account: { this.state.account }</p>
        <p>Create new set of contracts</p>
        <form ref={input => this.deployForm = input} onSubmit={e => this.deploy(e)}>
          <input ref={input => this.max_yays = input} name="max_yays" type="number" /> Max Yays
          <button onClick={this.deploy}>Deploy</button>
        </form>
        <p>Actual contracts:</p>
        <p>Gov: { this.state.gov }</p>
        <p>Iou: { this.state.iou }</p>
        <p>Chief: { this.state.chief }</p>
        <br />
        <p>GOV Balance: { web3.fromWei(this.state.GOVBalance).valueOf() }</p>
        <p>GOV Locked: { web3.fromWei(this.state.GOVLocked).valueOf() }</p>
        <br />
        <form ref={(input) => this.lockFreeForm = input} onSubmit={(e) => this.lockFree(e)}>
          <p>Lock/Free GOV</p>
          <input ref={(input) => this.amount = input} type="number" placeholder="Amount to be locked/freed" style={ {width: '200px'} }/>
          <select ref={(input) => this.methodLF = input} >
            <option value="lock">Lock</option>
            <option value="free">Free</option>
          </select>
          <input type="submit" />
        </form>
        <br />
        <p>Hat: { this.state.hat }</p>
        <br />
        <p>Slates Created:</p>
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
                    { key.substring(0,10) }...
                  </td>
                  <td>
                    {
                      this.state.slates[key].map(value => <p key={ value }>{ value }</p>)
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
        <br />
        <form ref={(input) => this.createSlateForm = input} onSubmit={(e) => this.createSlate(e)}>
          <p>New slate</p>
          <input ref={(input) => this.addresses = input} type="text" placeholder="Add addresses (comma separated)" style={ {width: '200px'} }/>
          <select ref={(input) => this.methodVE = input} >
            <option value="vote">Create and vote</option>
            <option value="etch">Just create</option>
          </select>
          <input type="submit" />
        </form>
        <br />
        <p>Candidates Ranking:</p>
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
            Object.keys(this.state.candidates).map(key =>
              <tr key={ key }>
                <td>{ key }</td>
                <td>{ web3.fromWei(this.state.candidates[key]).valueOf() }</td>
                <td>{ this.state.candidates[key] > this.state.candidates[this.state.hat] ? <a href="#lift" data-address={ key } onClick={ this.liftCandidate }>Lift this candidate</a> : '' }</td>
              </tr>
            )
          }
          </tbody>
        </table>
      </div>
    );
  }
}

export default App;
