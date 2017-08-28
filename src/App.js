import React, { Component } from 'react';
import logo from './logo.svg';
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
          });
        }
      });

      const gov = window.localStorage.getItem('gov');
      const iou = window.localStorage.getItem('iou');
      const chief = window.localStorage.getItem('chief');
      window.chiefObj = this.chiefObj = chiefContract.at(chief);
      window.govObj = this.govObj = tokenContract.at(gov);
      window.iouObj = this.iouObj = tokenContract.at(iou);
      if (gov && iou && chief && web3.isAddress(gov) && web3.isAddress(iou) && web3.isAddress(chief)) {
        this.setState({ gov, iou, chief }, () => {
          this.chiefObj.LogNote({ sig: [this.methodSig('etch(address[])'), this.methodSig('vote(address[])'), /*this.methodSig('vote(address[],address)')*/] }, { fromBlock: 0 }, (e, r) => {
            if (!e) {
              const addressesString = r.args.fax.substring(138);
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
              });
            }
          });
        });
      }
    }, 500);
  }

  methodSig = (method) => {
    return web3.sha3(method).substring(0, 10)
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

  vote = (e) => {
    e.preventDefault();
    this.chiefObj.vote.bytes32(e.target.getAttribute('data-slate'), (e, tx) => {
      console.log(tx);
    });
    return false;
  }

  render() {
    const gov = this.state.gov;
    const iou = this.state.iou;
    const chief = this.state.chief;
    return (
      <div className="App">
        <div className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>Welcome to React</h2>
        </div>
        <p className="App-intro">
          To get started, edit <code>src/App.js</code> and save to reload.
        </p>
        <p>Your account: { this.state.account }</p>
        <p>Create new set of contracts</p>
        <form ref={input => this.deployForm = input} onSubmit={e => this.deploy(e)}>
          <input ref={input => this.max_yays = input} name="max_yays" type="number" /> Max Yays
          <button onClick={this.deploy}>Deploy</button>
        </form>
        <p>Actual contracts:</p>
        <p>Gov: { gov }</p>
        <p>Iou: { iou }</p>
        <p>Chief: { chief }</p>
        <p>Slates:</p>
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
                    <a data-slate={ key } href="#vote" onClick={ this.vote }>Vote this</a>
                  </td>
                </tr>
              )
            }
          </tbody>
        </table>
        <table>
          <thead>
            <tr>
              <th>
                Candidate
              </th>
              <th>
                Weigth
              </th>
            </tr>
          </thead>
          <tbody>
          {
            Object.keys(this.state.candidates).map(key =>
              <tr key={ key }>
                <td>{ key }</td>
                <td>{ this.state.candidates[key].toNumber() }</td>
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
