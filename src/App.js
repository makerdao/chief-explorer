import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Web3 from 'web3';

const web3 = new Web3();
web3.setProvider(window.web3.currentProvider);
window.web3 = web3;
// var dschief = require('./config/dschief.json');
// var dstoken = require('./config/dstoken.json');
// window.dschief = dschief;
// window.dstoken = dstoken;
// var x = web3.eth.contract(dschief.abi).at("0xbd1d0b6aafcead1bf5989559649ffa7292072928");
// var t = web3.eth.contract(dstoken.abi).at("0x38e53179c5ca9906fac05c558858c2ed1146036c");
// window.x = x;
// window.t = t;
window.l = console.log;

class App extends Component {
  
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
      </div>
    );
  }
}

export default App;
