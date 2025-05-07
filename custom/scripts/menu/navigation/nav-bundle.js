document.addEventListener('DOMContentLoaded', () => {
    async function initializeNavigation() {
        const response = await fetch('/navigation/nav-data.json');
        const NAV_DATA = await response.json();

        // Sound system initialization
        const clickSound = new Audio('/sounds/click.mp3');
        const openSound = new Audio('/sounds/open.mp3');
        const closeSound = new Audio('/sounds/close.mp3');
        const hoverSound = new Audio('/sounds/hover.mp3');

        // Configure sound volumes
        clickSound.volume = 0.3;
        openSound.volume = 0.4;
        closeSound.volume = 0.4;
        hoverSound.volume = 0.2;

        // Sound player function
        const playSound = (sound) => {
            sound.currentTime = 0;
            sound.play().catch(e => console.log('Sound ready for interaction'));
        };

        // Preload sounds
        const sounds = [clickSound, openSound, closeSound, hoverSound];
        sounds.forEach(sound => {
            sound.load();
            sound.preload = 'auto';
        });

        // Insert HTML and handle navigation logic
        document.body.insertAdjacentHTML('beforeend', `
            <style>
                .nav-toggle {
                    position: fixed;
                    left: -130px;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 98;
                    animation: showInitial 0.5s forwards;
                    animation-delay: 1s;
                }

                @keyframes showInitial {
                    to {
                        left: -110px;
                    }
                }
                
                .exit-sign {
                    position: relative;
                    width: 160px;
                    height: 50px;
                    background: #007F3D;
                    border: 4px solid #fff;
                    border-radius: 4px;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    padding: 0 15px;
                    animation: popOut 5s infinite;
                }

                @keyframes popOut {
                      0%, 40% { transform: translateX(0); }
                    45% { transform: translateX(110px); }
                    85% { transform: translateX(110px); }
                    90%, 100% { transform: translateX(0); }
                }
                
                .exit-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    color: white;
                }
                
                .exit-text {
                    font-family: 'Highway Gothic', Arial, sans-serif;
                    font-size: 28px;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                
                .exit-arrow {
                    width: 24px;
                    height: 24px;
                    fill: white;
                    margin-left: auto;
                }

                .exit-arrow path {
                    stroke: white;
                    stroke-width: 2;
                }
                
                .side-nav {
                    position: fixed;
                    left: 0;
                    top: 0;
                    width: 450px;
                    height: 100vh;
                    background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.98));
                    backdrop-filter: blur(12px);
                    z-index: 99;
                    padding: 40px;
                    box-shadow: 0 0 30px rgba(0,0,0,0.1);
                    transform: translateX(-100%);
                    transition: all 0.5s cubic-bezier(0.87, 0, 0.13, 1);
                }

                .side-nav.active {
                    transform: translateX(0);
                    animation: slideToBottom 0.8s cubic-bezier(0.87, 0, 0.13, 1) forwards;
                    animation-delay: 0.5s;
                }

                @keyframes slideToBottom {
                    0% {
                        top: 0;
                    }
                    100% {
                        top: calc(100vh - 600px);
                    }
                }
                
                .nav-category {
                    margin-bottom: 35px;
                    transform-origin: left;
                    animation: slideIn 0.3s cubic-bezier(0.87, 0, 0.13, 1);
                }
                
                .nav-item {
                    padding: 15px;
                    margin-bottom: 15px;
                    background: white;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.87, 0, 0.13, 1);
                }
                
                .nav-item:hover {
                    transform: translateX(8px) translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                }
                
                .nav-close {
                    position: absolute;
                    right: 25px;
                    top: 25px;
                    font-size: 28px;
                    cursor: pointer;
                    color: #007F3D;
                }
                
                @keyframes slideIn {
                    from { 
                        opacity: 0;
                        transform: translateX(-20px);
                    }
                    to { 
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                .nav-category h3 {
                    color: #007F3D;
                    margin-bottom: 15px;
                }

                .nav-item h4 {
                    margin: 0;
                    color: #333;
                }

                .nav-item p {
                    margin: 5px 0 0;
                    color: #666;
                    font-size: 0.9em;
                }
            </style>
            <div class="nav-toggle">
                <div class="exit-sign">
                    <div class="exit-content">
                        <div class="exit-text">MENU</div>
                        <svg class="exit-arrow" viewBox="0 0 24 24">
                            <path d="M5 12h14m-7-7l7 7-7 7" fill="none"/>
                        </svg>
                    </div>
                </div>
            </div>
            <div class="side-nav">
                <div class="nav-close">×</div>
                <div id="nav-content"></div>
            </div>
        `);

        const navContent = document.getElementById('nav-content');

        NAV_DATA.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'nav-category';
            categoryDiv.innerHTML = `
                <h3>${category.category}</h3>
                ${category.items.map(item => `
                    <div class="nav-item" onclick="playSound(clickSound); window.location.href='${item.link}'">
                        <h4>${item.icon} ${item.name}</h4>
                        <p>${item.description}</p>
                    </div>
                `).join('')}
            `;
            navContent.appendChild(categoryDiv);
        });

        // Event listeners
        document.querySelector('.nav-toggle').addEventListener('click', (e) => {
            playSound(openSound);
            document.querySelector('.side-nav').classList.toggle('active');
        });

        document.querySelector('.nav-close').addEventListener('click', () => {
            playSound(closeSound);
            document.querySelector('.side-nav').classList.remove('active');
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                playSound(hoverSound);
            });
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.side-nav') && !e.target.closest('.nav-toggle')) {
                playSound(closeSound);
                document.querySelector('.side-nav').classList.remove('active');
            }
        });
    }

    // Call the async function
    initializeNavigation();
});