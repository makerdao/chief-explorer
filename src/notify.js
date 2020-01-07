import React, { Component } from 'react';

class Item extends Component {
  displayName = "Item";

  hideNotification = () => {
    this.props.hideNotification(this.props.id);
  }

  render() {
    return (
      React.createElement("div", { className: "notify-item " + this.props.theme, onClick: this.hideNotification },
        React.createElement("p", { className: "notify-title" }, this.props.title),

        React.createElement("p", { className: "notify-body" }, this.props.msg)
      )
    )
  }
}

class ReactNotify extends Component {
  displayName = "Notify";
  key = 0;

  constructor() {
    super();
    this.state = this.getInitialState();
  }

  getInitialState = () => {
    return {};
  }

  success = (key, title, msg, time) => {
    this.addNotify(key, title, msg, time, 'success');
  }

  error = (key, title, msg, time) => {
    this.addNotify(key, title, msg, time, 'error');
  }

  info = (key, title, msg, time) => {
    this.addNotify(key, title, msg, time, 'info');
  }

  addNotify = (key, title, msg, time, theme) => {
    const state = {...this.state}
    state[key] = { title: title, msg: msg, time: time, theme: theme };
    this.setState(state);
    this.countToHide(time, key);
  }

  countToHide = (duration, key) => {
    if (duration) {
      var that = this;
      setTimeout(function () {
        that.hideNotification(key);
      }, duration);
    }
  }

  hideNotification = (key) => {
    delete this.state[key];
    this.setState(this.state);
  }

  render() {
    var keys = Object.keys(this.state);
    var state = this.state;
    var hide = this.hideNotification;
    var el = keys.map(function (key) {
      return React.createElement(Item, {
        id: key,
        key: key,
        theme: state[key].theme,
        hideNotification: hide,
        title: state[key].title,
        msg: state[key].msg
      }
      )
    });
    return (React.createElement("div", { className: "notify-container" }, el));
  }
}

export default ReactNotify;
