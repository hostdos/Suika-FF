import React from 'react';
import ReactDOM from 'react-dom/client';
import Test from './test';
import {  } from "./firebase";

// eslint-disable-next-line no-restricted-globals
history.pushState(null, '', window.location.href);

const preventGoBack = () => {
  console.log("pop");
  const result = window.confirm("게임을 종료할까요?");
  if (result) {
    window.removeEventListener('popstate', preventGoBack);
  } else { 
    // eslint-disable-next-line no-restricted-globals  
    history.pushState(null, '', window.location.href);
  }
};
  
window.addEventListener('popstate', preventGoBack);

window.addEventListener("beforeunload", (ev) => 
{  
    ev.preventDefault();
    ev.returnValue = 'Are you sure you want to close?';
});

console.log(`The orientation of the screen is: ${window.screen.orientation.type}`);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

let firstLandscape = false;

function handleRotation(first: boolean = false) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile && window.screen.orientation.type.startsWith('landscape')) {
    let rootDiv = document.getElementById("root");
    let screenDiv = document.getElementById("rotateScreen");
    if (rootDiv) {
      rootDiv.style.display = 'none';
    }

    if (screenDiv) {
      screenDiv.style.display = 'flex';
    }

    if (first) {
      firstLandscape = true;
    }
  }
  else if (isMobile && window.screen.orientation.type.startsWith('portrait'))
  {
    if (firstLandscape) {
      window.location.reload();
    }
    
    let rootDiv = document.getElementById("root");
    let screenDiv = document.getElementById("rotateScreen");
    if (rootDiv) {
      rootDiv.style.display = 'block';
    }

    if (screenDiv) {
      screenDiv.style.display = 'none';
    }
  }
}

handleRotation(true);

window.addEventListener("orientationchange", () => {
  console.log(`The orientation of the screen is: ${window.screen.orientation.type}`);
  handleRotation();
})


root.render(<Test/>);
