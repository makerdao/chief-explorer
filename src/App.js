import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Web3 from 'web3';

const web3 = new Web3();

var dschief = require('./config/dschief.json');
var dstoken = require('./config/dstoken.json');
var chiefFab = web3.eth.contract(dschief.abi);
var tokenFab = web3.eth.contract(dstoken.abi);
window.dschief = dschief;
window.dstoken = dstoken;
window.chiefFab = chiefFab;
window.tokenFab = tokenFab;
window.l = console.log;

class App extends Component {
  state = {
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
    }, 500);
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
      tokenFab.new(symbol, { data: dstoken.bytecode, gas: 2000000 }, (error, tx) => {
        this.checkDeployedAddress(resolve, reject, error, tx);
      });
    })
  }

  deployChief = (gov, iou, max) => {
    return new Promise((resolve, reject) => {
      chiefFab.new(gov, iou, max, { data: dschief.bytecode, gas: 2000000 }, (error, tx) => {
        this.checkDeployedAddress(resolve, reject, error, tx);
      });
    })
  }

  render() {
    return (
      <div className="App">
        <div className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h2>Welcome to React</h2>
        </div>
        <p className="App-intro">
          To get started, edit <code>src/App.js</code> and save to reload.
        </p>
        <p>{this.state.account}</p>
        <form ref={input => this.deployForm = input} onSubmit={e => this.deploy(e)}>
          <input ref={input => this.max_yays = input} name="max_yays" type="number" /> Max Yays
          <button onClick={this.deploy}>Deploy</button>
        </form>
      </div>
    );
  }
}

export default App;
