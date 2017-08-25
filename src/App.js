import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Web3 from 'web3';

const web3 = new Web3();

var dschief = require('./config/dschief.json');
var dstoken = require('./config/dstoken.json');
var x = web3.eth.contract(dschief.abi);
var t = web3.eth.contract(dstoken.abi);
window.dschief = dschief;
window.dstoken = dstoken;
window.x = x;
window.t = t;
window.l = console.log;

class App extends Component {
  state = {
    account: null
  }

  componentDidMount() {
    web3.setProvider(window.web3 ?
      window.web3.currentProvider :
      new Web3.providers.HttpProvider('http://localhost:8545')
    );
    window.web3 = web3;
    web3.eth.getAccounts((e,r) => {
      this.setState({
        account: r[0] || 'no account'
      })
    });
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
      </div>
    );
  }
}

export default App;
