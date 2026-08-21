// import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import CustomImage from './Image'

function App() {
  //const [count, setCount] = useState(0)


  /*
  TODO
  - need way to store marble api operation id upon creation
   */

  const marbleApiKey = ''

  async function testMarblePost() {
    const response = await fetch('https://api.worldlabs.ai/marble/v1/worlds:generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'WLT-Api-Key': marbleApiKey
      },
      body: JSON.stringify({
        display_name: 'Mystical Forest',
        model: 'marble-1.1',
        world_prompt: {
          type: 'text',
          text_prompt: 'A mystical forest with glowing mushrooms'
        }
      })
    });
    const data = await response.json();
    console.log(data);
  }

  async function testMarbleGet() {
    const response = await fetch('https://api.worldlabs.ai/marble/v1/operations/24826b1d-0caa-480c-8dd1-936a32f4989a', {
      method: 'GET',
      headers: {
        'WLT-Api-Key': marbleApiKey
      }
    });

    const data = await response.json();

    console.log(data);
  }

  async function testMarbleGet() {
    const response = await fetch('https://api.worldlabs.ai/marble/v1/operations/20bffbb1-4ba7-453f-a116-93eaw1a6843e', {
      method: 'GET',
      headers: {
        'WLT-Api-Key': 'zdtjd5AyINg7KjXB2l2J66qKYFRjrmcd'
      }
    });

    const data = await response.json();

    console.log(data);
  }

  function fetchCustomer(name){
    fetch(`/api/customer/${"Jacob"}`, {method: "GET"}
    ).then(res => res.json()
    ).then(customer => console.log(customer))
    name.target.textContent = "something"
  }
  return (
    <>
      <section id="center">
        <div className="hero">
          <CustomImage {... {src: heroImg, className: "base", width: 170, height: 179}} />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={fetchCustomer}
        >
          Count is {}
        </button>
        <button
            type="button"
            className="marble"
            onClick={testMarblePost}
        >
          Test Marble!
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
