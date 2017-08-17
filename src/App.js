import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Web3 from 'web3';

setTimeout(() => {
  const web3 = new Web3();
  web3.setProvider(window.web3.currentProvider || 'http://localhost:8545');
  window.web3 = web3;
}, 500);

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
