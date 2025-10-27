/* 
 * Kattskrälle
 * Copyright (C) 2025 Leo Forsmark
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
let isInitiatingPageLoad = false;
let users = [];
let lowestPageLoaded = 0;
let highestPageLoaded = 0;
let highestPage = 0;
let currentPage = 0;
let threadId = "";
let nextPageLoaded = 0;
let startOrEnd = "";
let pagesLoaded = [];
let navigationBars = [];
let floatingDivPage = 0;
let ignoreraSetting = false;
let previewsSetting = false;
let infiniteScrollSetting = false;
let bypassLeavingSetting = false;
let showTsSetting = false;
let threadTS = "";
let markReadThreadsSetting = false;
let ignoreInQuotesSetting = false;
let saveDraftsSetting = false;
let searchLinksSetting = false;
const fetchQueue = [];
let isFetching = false;
let scrollTimeout;
let searchCancelled = false;

function tryTriggerForwardLoad(preloadMargin = 800) {
    try {
        if (threadId.substring(0,2) !== '/t') return;

        if (highestPageLoaded >= highestPage) return;

        const nearBottom = (window.innerHeight + Math.round(window.scrollY)) >= (document.body.offsetHeight - preloadMargin);
        if (!nearBottom) return;

        if (isInitiatingPageLoad || nextPageLoaded === 1) return;

        nextPageLoaded = 1;
        initiatePageLoadForward();
    } catch (e) {
        console.error('tryTriggerForwardLoad error', e);
    }
}
function ensureDefaultSettings(callback) {
    const defaultSettings = {
        'Ignorera': true,
        'Previews': true,
        'Infinite Scroll': true,
        'Bypass Leaving Site': true,
        'Visa Trådskapare(TS)': true,
        'Markera visade trådar': true,
        'Ignorera även i citat': true,
        'Spara & ladda utkast': true,
        'Sök länkar': true
    };

    function saveDefaultsToChrome() {
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
            chrome.storage.sync.set({ userStorageFbqol: defaultSettings }, callback);
        } else if (typeof browser !== 'undefined' && browser.storage?.local) {
            browser.storage.local.set({ userStorageFbqol: defaultSettings }).then(callback);
        } else {
            callback();
        }
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
        chrome.storage.sync.get('userStorageFbqol', (result) => {
            if (!result.userStorageFbqol || Object.keys(result.userStorageFbqol).length === 0) {
                saveDefaultsToChrome();
            } else {
                callback();
            }
        });
    } else if (typeof browser !== 'undefined' && browser.storage?.local) {
        browser.storage.local.get('userStorageFbqol').then(result => {
            if (!result.userStorageFbqol || Object.keys(result.userStorageFbqol).length === 0) {
                saveDefaultsToChrome();
            } else {
                callback();
            }
        });
    } else {
        callback();
    }
}


function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
        chrome.storage.sync.get('userStorageFbqol', (result) => {
            const settings = result.userStorageFbqol || {};
            applySettings(settings);
        });
    } else if (typeof browser !== 'undefined' && browser.storage?.local) {
        browser.storage.local.get('userStorageFbqol').then(result => {
            const settings = result.userStorageFbqol || {};
            applySettings(settings);
        });
    } else {
        //console.error("KATTSKRÄLLE: No storage API available. Settings cannot be loaded.");
    }
}

function applySettings(settings) {
    ignoreraSetting = !!settings['Ignorera'];
    previewsSetting = !!settings['Previews'];
    infiniteScrollSetting = !!settings['Infinite Scroll'];
    bypassLeavingSetting = !!settings['Bypass Leaving Site'];
    showTsSetting = !!settings['Visa Trådskapare(TS)'];
    markReadThreadsSetting = !!settings['Markera visade trådar'];
    ignoreInQuotesSetting = !!settings['Ignorera även i citat'];
    saveDraftsSetting = !!settings['Spara & ladda utkast'];
    searchLinksSetting = !!settings['Sök länkar'];

    if (!infiniteScrollSetting && !previewsSetting && !ignoreraSetting && !bypassLeavingSetting && !showTsSetting && !markReadThreadsSetting && !saveDraftsSetting && !searchLinksSetting) {
        return;// Early exit if all settings are false
    }
    main();//only call main if any settings are activated. 
}

function saveUsers(users) {
    try {
        chrome.storage.sync.set({ userStorageFbqolIgnore: users });
    } catch (error) {
        browser.storage.local.set({ userStorageFbqolIgnore: users });
    }
}

function getUsers(callback) {
    try {
        chrome.storage.sync.get(['userStorageFbqolIgnore'], function(result) {
            if (result.userStorageFbqolIgnore) {
                callback(result.userStorageFbqolIgnore);
            } else {
                callback([]);
            }
        });
    } catch (error) {
        browser.storage.local.get(['userStorageFbqolIgnore'], function(result) {
            if (result.userStorageFbqolIgnore) {
                callback(result.userStorageFbqolIgnore);
            } else {
                callback([]);
            }
        });
    }
}

function removePost(postNumber) {
    var post = document.getElementById(postNumber);
    if (post) {
        post.remove();
    }
}

function findPosts(){
    //new function ignoreInQuotes - removes post if it quotes a ignored user. 
    if (ignoreraSetting===true && ignoreInQuotesSetting===true){
        removePostsWithIgnoredQuotes(users);
    }
    const postsOnPage = document.getElementsByClassName('post-user-username dropdown-toggle');
    if (postsOnPage.length > 0) {
        Array.from(postsOnPage).forEach(element => {
            var postUser=element.innerHTML.trim()
            //old code
            if (ignoreraSetting===true){
                if (users.includes(postUser)){
                    removePost(element.id.split('dropdown-user-')[1])
                } else {
                        addIgnoreButton(element.id.split('dropdown-user-')[1], postUser);
                };
            };

            if (previewsSetting===true){
                addPreviewsToPosts();
            }
            if (showTsSetting === true && threadId && threadTS) {
                markTSPostsInDom();
            };
        })
    }
}

function removePostsWithIgnoredQuotes(users) {
    // Select all posts on the page
    const posts = document.querySelectorAll('.post');

    posts.forEach(post => {
        // Look for any quote blocks inside this post
        const quotes = post.querySelectorAll('.post-bbcode-quote, .post-bbcode-quote-wrapper');

        quotes.forEach(quote => {
            const headerDiv = quote.querySelector('div');
            if (!headerDiv) return;

            const strongEl = headerDiv.querySelector('strong');
            if (strongEl) {
                const quotedUser = strongEl.textContent.trim();
                if (users.includes(quotedUser)) {
                    // Remove the entire post
                    post.remove();
                }
            }
        });
    });
}

function addPreviewsToPosts() {
    const posts = document.querySelectorAll('.post_message');

    function decodeHTMLEntities(str = '') {
        const ta = document.createElement('textarea');
        ta.innerHTML = str;
        return ta.value;
    }

    function cleanHref(raw) {
        try {
            if (raw.includes('leave.php')) {
                const parsed = new URL(raw, window.location.origin);
                const u = parsed.searchParams.get('u');
                if (u) return decodeHTMLEntities(decodeURIComponent(u));
            }
            return decodeHTMLEntities(raw);
        } catch (e) {
            return raw;
        }
    }

    function getUniqueColor(usedColors) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
            '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
            '#C44569', '#F8B500', '#6C5CE7', '#A29BFE', '#FD79A8',
            '#E17055', '#00B894', '#0984E3', '#A29BFE', '#FDCB6E',
            '#E84393', '#6C5CE7', '#74B9FF', '#00CEC9', '#55A3FF'
        ];
        
        const availableColors = colors.filter(color => !usedColors.has(color));
        if (availableColors.length === 0) {
            // If all colors are used, start reusing but with transparency
            return colors[Math.floor(Math.random() * colors.length)] + '80';
        }
        
        const selectedColor = availableColors[Math.floor(Math.random() * availableColors.length)];
        usedColors.add(selectedColor);
        return selectedColor;
    }

    function extractContextAroundUrl(post, url, originalUrl, element, linkColor, contextLength = 100) {
        // Get the full text content of the post
        const postText = post.textContent || post.innerText || '';
        
        // Find the link text in the post
        const linkText = element.textContent || element.innerText || url;
        const linkIndex = postText.indexOf(linkText);
        
        if (linkIndex === -1) {
            // Fallback: just return the styled link
            return `<a href="${url}" style="color: ${linkColor}; font-weight: bold;">${linkText}</a>`;
        }
        
        // Calculate boundaries
        const beforeStart = Math.max(0, linkIndex - contextLength);
        const afterEnd = Math.min(postText.length, linkIndex + linkText.length + contextLength);
        
        // Extract text before and after
        let beforeText = postText.substring(beforeStart, linkIndex);
        let afterText = postText.substring(linkIndex + linkText.length, afterEnd);
        
        // Check for quotes in before text - stop at last [QUOTE
        const quoteStart = beforeText.lastIndexOf('[QUOTE');
        if (quoteStart !== -1) {
            const quoteEnd = beforeText.indexOf(']', quoteStart);
            if (quoteEnd !== -1) {
                beforeText = beforeText.substring(quoteEnd + 1);
            }
        }
        
        // Check for quotes in after text - stop at first [/QUOTE]
        const quoteEndIndex = afterText.indexOf('[/QUOTE]');
        if (quoteEndIndex !== -1) {
            afterText = afterText.substring(0, quoteEndIndex);
        }
        
        // Check for other links in before text - stop after last link
        const linkPattern = /https?:\/\/[^\s\]]+/gi;
        let beforeMatch;
        let lastLinkEnd = -1;
        while ((beforeMatch = linkPattern.exec(beforeText)) !== null) {
            lastLinkEnd = beforeMatch.index + beforeMatch[0].length;
        }
        if (lastLinkEnd !== -1) {
            beforeText = beforeText.substring(lastLinkEnd);
        }
        
        // Check for other links in after text - stop before first link
        linkPattern.lastIndex = 0; // Reset regex
        const afterMatch = linkPattern.exec(afterText);
        if (afterMatch !== null) {
            afterText = afterText.substring(0, afterMatch.index);
        }
        
        // Add ellipsis if we truncated
        if (beforeStart > 0 && beforeText.length > 0) {
            beforeText = '...' + beforeText;
        }
        if (afterEnd < postText.length && afterText.length > 0) {
            afterText = afterText + '...';
        }
        
        // Return the combined result
        return beforeText + `<a href="${url}" style="color: ${linkColor}; font-weight: bold; font-size: 12px;">${linkText}</a>` + afterText;
    }

    const imageExtensions = ['jpg','jpeg','png','gif','webp','bmp'];
    const videoExtensions = ['mp4', 'webm', 'ogg'];

    posts.forEach(post => {
        if (post.querySelector('.FBQOLPreview')) return;

        const previewDiv = document.createElement('div');
        previewDiv.className = 'FBQOLPreview';
        previewDiv.style.border = '2px solid #ccc';
        previewDiv.style.borderRadius = '8px';
        previewDiv.style.padding = '15px';
        previewDiv.style.margin = '10px 0';
        previewDiv.style.backgroundColor = 'transparent';
        
        const headerContainer = document.createElement('div');
        headerContainer.style.display = 'flex';
        headerContainer.style.justifyContent = 'space-between';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.margin = '0 0 15px 0';
        
        const header = document.createElement('h4');
        header.textContent = 'Media i inlägg';
        header.style.margin = '0';
        header.style.color = '#333';
        header.style.fontSize = '16px';
        header.style.fontWeight = 'bold';
        
        const toggleButton = document.createElement('button');
        toggleButton.textContent = '−';
        toggleButton.style.background = '#666';
        toggleButton.style.color = 'white';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '3px';
        toggleButton.style.padding = '2px 8px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.fontSize = '16px';
        toggleButton.style.fontWeight = 'bold';
        
        headerContainer.appendChild(header);
        headerContainer.appendChild(toggleButton);
        previewDiv.appendChild(headerContainer);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'FBQOLPreviewContent';
        previewDiv.appendChild(contentContainer);

        let isHidden = false;
        toggleButton.addEventListener('click', function() {
            if (isHidden) {
                contentContainer.style.display = 'block';
                toggleButton.textContent = '−';
                isHidden = false;
            } else {
                contentContainer.style.display = 'none';
                toggleButton.textContent = '+';
                isHidden = true;
            }
        });

        let added = false;
        
        const urls = Array.from(post.querySelectorAll('a[href]'))
            .filter(a => !a.closest('.post-clamped-text'))
            .map(a => ({ 
                url: cleanHref(a.href), 
                element: a,
                originalUrl: a.href 
            }));

        const seen = new Set();
        const usedColors = new Set();

        urls.forEach(({url, element, originalUrl}) => {
            if (!url) return;
            let m;

            // --- YouTube ---
            m = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w\-]{11})/i);
            if (m && !seen.has('yt:' + m[1])) {
                seen.add('yt:' + m[1]);
                
                const linkColor = getUniqueColor(usedColors);
                element.style.color = linkColor;
                element.style.fontWeight = 'bold';

                const wrapperDiv = document.createElement('div');
                wrapperDiv.style.border = '2px solid #ccc';
                wrapperDiv.style.borderRadius = '8px';
                wrapperDiv.style.padding = '10px';
                wrapperDiv.style.marginBottom = '5px';
                wrapperDiv.style.backgroundColor = 'transparent';

                const contextDiv = document.createElement('div');
                contextDiv.style.marginBottom = '10px';
                contextDiv.style.padding = '8px';
                contextDiv.style.backgroundColor = 'transparent';
                contextDiv.style.borderRadius = '4px';
                contextDiv.style.fontSize = '12px';
                contextDiv.style.color = '#666';
                
                const context = extractContextAroundUrl(post, url, originalUrl, element, linkColor);
                contextDiv.innerHTML = context;
                wrapperDiv.appendChild(contextDiv);
                
                const iframe = document.createElement('iframe');
                iframe.width = '560';
                iframe.height = '315';
                iframe.src = `https://www.youtube.com/embed/${m[1]}`;
                iframe.frameBorder = '0';
                iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
                iframe.allowFullscreen = true;
                iframe.style.display = 'block';
                iframe.style.margin = '10px 0 20px 0';
                wrapperDiv.appendChild(iframe);
                
                contentContainer.appendChild(wrapperDiv);
                added = true;
                return;
            }

           // --- TikTok ---
            m = url.match(/https?:\/\/(?:www\.)?tiktok\.com\/(@[\w.-]+\/video\/(\d+))/i);
            if (m && !seen.has('tt:' + m[1])) {
                seen.add('tt:' + m[1]);

                const linkColor = getUniqueColor(usedColors);
                element.style.color = linkColor;
                element.style.fontWeight = 'bold';

                const wrapperDiv = document.createElement('div');
                wrapperDiv.style.border = '2px solid #ccc';
                wrapperDiv.style.borderRadius = '8px';
                wrapperDiv.style.padding = '10px';
                wrapperDiv.style.marginBottom = '5px';
                wrapperDiv.style.backgroundColor = 'transparent';

                // Add context and link
                const contextDiv = document.createElement('div');
                contextDiv.style.marginBottom = '10px';
                contextDiv.style.padding = '8px';
                contextDiv.style.backgroundColor = 'transparent';
                contextDiv.style.borderRadius = '4px';
                contextDiv.style.fontSize = '12px';
                contextDiv.style.color = '#666';
                
                const context = extractContextAroundUrl(post, url, originalUrl, element, linkColor);
                contextDiv.innerHTML = context;
                wrapperDiv.appendChild(contextDiv);

                const iframe = document.createElement('iframe');
                iframe.src = `https://www.tiktok.com/embed/v2/${m[2]}`;
                iframe.width = '100%';
                iframe.style.maxWidth = '560px';
                iframe.height = '600'; 
                iframe.style.display = 'block';
                iframe.style.margin = '10px 0 20px 0';
                iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
                iframe.frameBorder = 0;

                wrapperDiv.appendChild(iframe);
                contentContainer.appendChild(wrapperDiv);
                added = true;
                return;
            }

            // --- Spotify ---
            m = url.match(/https?:\/\/open\.spotify\.com\/(artist|track|album|playlist)\/([a-zA-Z0-9]+)/i);
            if (m && !seen.has('spotify:' + m[2])) {
                seen.add('spotify:' + m[2]);
                
                const linkColor = getUniqueColor(usedColors);
                element.style.color = linkColor;
                element.style.fontWeight = 'bold';
                
                const wrapperDiv = document.createElement('div');
                wrapperDiv.style.border = '2px solid #ccc';
                wrapperDiv.style.borderRadius = '8px';
                wrapperDiv.style.padding = '10px';
                wrapperDiv.style.marginBottom = '5px';
                wrapperDiv.style.backgroundColor = 'transparent';
                
                // Add context and link
                const contextDiv = document.createElement('div');
                contextDiv.style.marginBottom = '10px';
                contextDiv.style.padding = '8px';
                contextDiv.style.backgroundColor = 'transparent';
                contextDiv.style.borderRadius = '4px';
                contextDiv.style.fontSize = '12px';
                contextDiv.style.color = '#666';
                
                const context = extractContextAroundUrl(post, url, originalUrl, element, linkColor);
                contextDiv.innerHTML = context;
                wrapperDiv.appendChild(contextDiv);
                
                fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
                    .then(res => res.json())
                    .then(data => {
                        const match = data.html.match(/src="([^"]+)"/);
                        if (!match) return;

                        const iframe = document.createElement('iframe');
                        iframe.src = match[1];
                        iframe.width = '100%';
                        iframe.style.maxWidth = '400px';
                        iframe.style.height = '380px';
                        iframe.style.display = 'block';
                        iframe.style.margin = '10px 0 20px 0';
                        iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
                        iframe.frameBorder = 0;

                        wrapperDiv.appendChild(iframe);
                    })
                    .catch(e => console.error('Spotify oEmbed failed', e));

                contentContainer.appendChild(wrapperDiv);
                added = true;
                return;
            }

            // --- Imgur ---
            m = url.match(/https?:\/\/(?:i\.)?imgur\.com\/([a-zA-Z0-9]+)(\.[a-zA-Z]{3,4})?$/i);
            if (m) {
                const imgUrl = m[2] ? url : `https://i.imgur.com/${m[1]}.jpg`;
                if (!seen.has('imgur:' + imgUrl)) {
                    seen.add('imgur:' + imgUrl);
                    
                    const linkColor = getUniqueColor(usedColors);
                    element.style.color = linkColor;
                    element.style.fontWeight = 'bold';
                    
                    const wrapperDiv = document.createElement('div');
                    wrapperDiv.style.border = '2px solid #ccc';
                    wrapperDiv.style.borderRadius = '8px';
                    wrapperDiv.style.padding = '10px';
                    wrapperDiv.style.marginBottom = '5px';
                    wrapperDiv.style.backgroundColor = 'transparent';
                    
                    // Add context and link
                    const contextDiv = document.createElement('div');
                    contextDiv.style.marginBottom = '10px';
                    contextDiv.style.padding = '8px';
                    contextDiv.style.backgroundColor = 'transparent';
                    contextDiv.style.borderRadius = '4px';
                    contextDiv.style.fontSize = '12px';
                    contextDiv.style.color = '#666';
                    
                    const context = extractContextAroundUrl(post, url, originalUrl, element, linkColor);
                    contextDiv.innerHTML = context;
                    wrapperDiv.appendChild(contextDiv);
                    
                    const img = document.createElement('img');
                    img.src = imgUrl;
                    img.style.width = '100%';
                    img.style.height = 'auto';
                    img.style.display = 'block';
                    img.style.margin = '10px 0 20px 0';
                    wrapperDiv.appendChild(img);
                    
                    contentContainer.appendChild(wrapperDiv);
                    added = true;
                    return;
                }
            }

            if (url.match(/https?:\/\/imgur\.com\/a\/[a-zA-Z0-9]+/i)) return; // skip albums

            // --- Generic image links ---
            const extMatch = url.match(/\.(\w{2,5})(?:\?.*)?$/i);
            if (extMatch && imageExtensions.includes(extMatch[1].toLowerCase()) && !seen.has('file:' + url)) {
                seen.add('file:' + url);
                
                // Assign color to this link since it will generate a preview
                const linkColor = getUniqueColor(usedColors);
                element.style.color = linkColor;
                element.style.fontWeight = 'bold';
                
                const wrapperDiv = document.createElement('div');
                wrapperDiv.style.border = '2px solid #ccc';
                wrapperDiv.style.borderRadius = '8px';
                wrapperDiv.style.padding = '10px';
                wrapperDiv.style.marginBottom = '5px';
                wrapperDiv.style.backgroundColor = 'transparent';
                
                // Add context and link
                const contextDiv = document.createElement('div');
                contextDiv.style.marginBottom = '10px';
                contextDiv.style.padding = '8px';
                contextDiv.style.backgroundColor = 'transparent';
                contextDiv.style.borderRadius = '4px';
                contextDiv.style.fontSize = '12px';
                contextDiv.style.color = '#666';
                
                const context = extractContextAroundUrl(post, url, originalUrl, element, linkColor);
                contextDiv.innerHTML = context;
                wrapperDiv.appendChild(contextDiv);
                
                const img = document.createElement('img');
                img.src = url;
                img.style.width = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.margin = '10px 0 20px 0';
                wrapperDiv.appendChild(img);
                
                contentContainer.appendChild(wrapperDiv);
                added = true;
                return;
            }

            // --- Generic video links ---
            const videoMatch = url.match(/\.(\w{2,5})(?:\?.*)?$/i);
            if (videoMatch && videoExtensions.includes(videoMatch[1].toLowerCase()) && !seen.has('video:' + url)) {
                seen.add('video:' + url);
                
                // Assign color to this link since it will generate a preview
                const linkColor = getUniqueColor(usedColors);
                element.style.color = linkColor;
                element.style.fontWeight = 'bold';
                
                const wrapperDiv = document.createElement('div');
                wrapperDiv.style.border = '2px solid #ccc';
                wrapperDiv.style.borderRadius = '8px';
                wrapperDiv.style.padding = '10px';
                wrapperDiv.style.marginBottom = '5px';
                wrapperDiv.style.backgroundColor = 'transparent';
                
                // Add context and link
                const contextDiv = document.createElement('div');
                contextDiv.style.marginBottom = '10px';
                contextDiv.style.padding = '8px';
                contextDiv.style.backgroundColor = 'transparent';
                contextDiv.style.borderRadius = '4px';
                contextDiv.style.fontSize = '12px';
                contextDiv.style.color = '#666';
                
                const context = extractContextAroundUrl(post, url, originalUrl, element, linkColor);
                contextDiv.innerHTML = context;
                wrapperDiv.appendChild(contextDiv);
                
                const video = document.createElement('video');
                video.src = url;
                video.controls = true;
                video.style.maxWidth = '100%';
                video.style.display = 'block';
                video.style.margin = '10px 0 20px 0';
                wrapperDiv.appendChild(video);
                
                contentContainer.appendChild(wrapperDiv);
                added = true;
                return;
            } 
        });

        if (added) post.appendChild(previewDiv);
    });
}

function decodeLeaveHref(raw){try{if(!raw)return raw;const parsed=new URL(raw,window.location.origin);if(parsed.pathname.endsWith('/leave.php')){const u=parsed.searchParams.get('u');if(u)return decodeURIComponent(u)}return raw}catch(e){return raw}}
function rewriteLeaveLinks(){const as=Array.from(document.querySelectorAll('a[href*="leave.php?u="],a[href*="/leave.php?u="]'));as.forEach(a=>{const nh=decodeLeaveHref(a.getAttribute('href'));if(nh&&nh!==a.getAttribute('href')){a.setAttribute('href',nh);a.removeAttribute('onclick');a.removeAttribute('target')}})}
function addIgnoreButton(postNumber, userNameToButton) {
    var postUserInfo = document.getElementById(postNumber).querySelector('.post-user-info.small');
    if (postUserInfo) {
        postUserInfo.querySelectorAll('.ignoreButton').forEach(e => e.remove());
        var ignoreButton = document.createElement('button');
        ignoreButton.className = 'ignoreButton';
        ignoreButton.innerHTML = ('Ignorera ' + userNameToButton);
        ignoreButton.style.display = "inline-block";
        ignoreButton.style.padding = "1px 3px";
        ignoreButton.style.fontSize = "10px";
        ignoreButton.style.fontWeight = "bold";
        ignoreButton.style.color = "#000";
        ignoreButton.style.backgroundColor = "#ccc";
        ignoreButton.style.border = "0.5px solid #999";
        ignoreButton.style.borderRadius = "2px";
        ignoreButton.style.cursor = "pointer";
        ignoreButton.style.marginRight = "4px";
        ignoreButton.style.marginBottom = "2px";
        ignoreButton.addEventListener('click', function() {
            users.push(userNameToButton);
            saveUsers(users);
            getUsers(function(retrievedUsers) {
                users = retrievedUsers;
                findPosts();
            });
        });
        postUserInfo.appendChild(ignoreButton);
    }
} 

function fetchPostsFromPage(urlToFetch) {
    fetchQueue.push(urlToFetch);
    processFetchQueue();
}

function processFetchQueue() {
    if (isFetching || fetchQueue.length === 0) return;
    isFetching = true;

    const url = fetchQueue.shift();

    try {
        if (!chrome.runtime || !chrome.runtime.sendMessage) {
            //console.warn("chrome.runtime.sendMessage not available. Re-queueing:", url);
            setTimeout(() => fetchPostsFromPage(url), 1000);
            isFetching = false;
            return;
        }

        chrome.runtime.sendMessage({ message: "fetchSite", url }, (response) => {
            isFetching = false;

            if (chrome.runtime.lastError) {
                //console.warn("sendMessage failed:", chrome.runtime.lastError.message);
                setTimeout(() => fetchPostsFromPage(url), 1000);
                return;
            }

            if (response && response.response) {
                addPostsToDom(response.response);
            } else {
                //console.warn("No response received for", url);
                setTimeout(() => fetchPostsFromPage(url), 1000);
            }

            processFetchQueue();
        });
    } catch (e) {
        //console.error("sendMessage threw:", e);
        isFetching = false;
        setTimeout(() => fetchPostsFromPage(url), 1000);
    }
}

function sortPosts(){
    var container = document.getElementById('posts');
    var postDivs = Array.from(container.getElementsByClassName('post'));
    var uniquePosts = new Map();

    postDivs.forEach(function(postDiv) {
        var postId = postDiv.getAttribute('data-postid');
        if (!uniquePosts.has(postId)) {
            uniquePosts.set(postId, postDiv);
        }
    });
    var sortedUniquePosts = Array.from(uniquePosts.values()).sort(function(a, b) {
        var idA = parseInt(a.getAttribute('data-postid'), 10);
        var idB = parseInt(b.getAttribute('data-postid'), 10);
        return idA - idB;
    });
    container.innerHTML = '';
    sortedUniquePosts.forEach(function(postDiv) {
        container.appendChild(postDiv);
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.message === "parseHTML") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(request.html, 'text/html');
        const postsDiv = doc.getElementById('posts');
        let postsHtml = postsDiv ? postsDiv.innerHTML : 'No posts found';
        sendResponse({ response: postsHtml });

        const navDiv = doc.getElementsByClassName('pagination pagination-xs')[0];
        let htmlPageNumber;
        if (postsHtml !== 'No posts found' && navDiv) {
            const dataPage = doc.getElementsByClassName('input-page-jump')[0];
            if (dataPage) {
                htmlPageNumber = parseInt(dataPage.getAttribute('data-page'));
                navigationBars[htmlPageNumber] = navDiv.outerHTML;
                changeNavBars();
                updateFloatingDiv(htmlPageNumber);
            } else {
                // fallback
            }
        }

        if (postsHtml !== 'No posts found') {
            if (typeof htmlPageNumber !== 'undefined') {
                postsHtml = addPageNumberToPosts(postsHtml, htmlPageNumber);
            }
            addPostsToDom(postsHtml);
            // posts added, allow next load
            nextPageLoaded = 0;
            isInitiatingPageLoad = false;
            addLoadLastPageButton();
        } else {
            // no posts found -> reset flags so we can try again later
            nextPageLoaded = 0;
            isInitiatingPageLoad = false;
        }
    }
});


function addPageNumberToPosts(postsHtmlToAddPageNumbersTo, pageNumberToAdd) {
    //console.log("Adding page number to posts: page " + pageNumberToAdd);
    const parser = new DOMParser();
    const doc = parser.parseFromString(postsHtmlToAddPageNumbersTo, 'text/html');
    const posts = doc.querySelectorAll('div.post');
    posts.forEach(post => {
        post.setAttribute('pagenumber', pageNumberToAdd);
    });
    return doc.body.innerHTML;
};

function changeNavBars() {   
    let paginationElements = document.querySelectorAll('ul.pagination.pagination-xs');
    if (paginationElements.length === 0) return;
    // Updatedate first navigation bar
    if (navigationBars[lowestPageLoaded]) {
        paginationElements[0].outerHTML = navigationBars[lowestPageLoaded];
    } else {
        //console.log("Navbar for lowest page not saved yet:", lowestPageLoaded);
        // fallback: keep existing navbar
    }

    // Update the second navigation bar (highest page), if it exists
    if (paginationElements.length > 1) {
        if (navigationBars[highestPageLoaded]) {
            paginationElements[1].outerHTML = navigationBars[highestPageLoaded];
        } else {
            //console.log("Navbar for highest page not saved yet:", highestPageLoaded);
            // fallback: keep existing navbar
        }
    }
};

function addPostsToDom(postsToAdd){
    const parser = new DOMParser();
    const doc = parser.parseFromString(postsToAdd, 'text/html');
    const newPosts = Array.from(doc.querySelectorAll('div.post'));
    const container = document.getElementById("posts");
    if (!container || newPosts.length === 0) return;

    getUsers(function(retrievedUsers) {
        users = retrievedUsers || [];

        const existingLivePosts = Array.from(container.querySelectorAll('div.post'));
        const existingIds = new Set(existingLivePosts.map(p => p.getAttribute('data-postid')));

        //sort posts
        newPosts.sort((a,b) => {
            return parseInt(a.getAttribute('data-postid')||0, 10) - parseInt(b.getAttribute('data-postid')||0, 10);
        });

        newPosts.forEach(newPost => {
            const postId = newPost.getAttribute('data-postid');
            if (!postId) return;
            if (existingIds.has(postId)) return; //if post exists in DOM skip it

            // if ignore setting is true then check if user is in ignore list.  
            if (ignoreraSetting === true) {
                const userEl = newPost.querySelector('.post-user-username.dropdown-toggle') || newPost.querySelector('.post-user-username');
                const userName = userEl ? userEl.textContent.trim() : null;
                if (userName && users.includes(userName)) {
                    return; // ignorera detta nya inlägg
                }
            }

            const imported = document.importNode(newPost, true);

            const existingNow = Array.from(container.querySelectorAll('div.post'));
            let next = existingNow.find(p => parseInt(p.getAttribute('data-postid')||0, 10) > parseInt(postId, 10));

            if (next) {
                container.insertBefore(imported, next);
            } else {
                container.appendChild(imported);
            }
            existingIds.add(postId);
        });

        if(bypassLeavingSetting){rewriteLeaveLinks()}
        findPosts();          // Adds ignore buttons an previews
        addPageSeparators();  // adds page separators 
        addLoadLastPageButton();//adds load last page button if needed
        const pageNumbersNow = Array.from(document.querySelectorAll('.post'))
            .map(p => parseInt(p.getAttribute('pagenumber') || '', 10))
            .filter(n => !isNaN(n));
        if (pageNumbersNow.length > 0 && Math.min(...pageNumbersNow) === 1) {
            document.querySelectorAll('#loadLastPageButton, .load-page-button').forEach(btn => btn.remove());
        }
    });
}

function saveFirstNavbar(pageNumb) {
    const navDiv = document.getElementsByClassName('pagination pagination-xs')[0];
    if (navDiv) {
        const dataPage = document.getElementsByClassName('input-page-jump')[0];
        const htmlPageNumber = parseInt(dataPage.getAttribute('data-page'));
        navigationBars[pageNumb] = navDiv.outerHTML;
    }
}

function getThreadInfo(){
    const threadInfoElement = document.getElementsByClassName('input-page-jump')[0];
    if (threadInfoElement){
        threadId = threadInfoElement.getAttribute('data-url');
        highestPage = parseInt(threadInfoElement.getAttribute('data-total-pages'));
        currentPage = parseInt(threadInfoElement.getAttribute('data-page'));
        lowestPageLoaded = parseInt(threadInfoElement.getAttribute('data-page'));
        highestPageLoaded = parseInt(threadInfoElement.getAttribute('data-page'));
        pagesLoaded.push(currentPage);
        //console.log("threadId:" +threadId);
        //console.log("highestPage:"+highestPage);
        //console.log("currentPage:"+currentPage);
        //console.log("lowestPageLoaded:"+lowestPageLoaded);
    }
};

function initiatePageLoadForward(){
    // extra guard to avoid duplicate initiations
    if (isInitiatingPageLoad) return;

    startOrEnd='end';
    //console.log("initiateforward-highest:" + highestPage)
    //console.log("initiateforward-highestloaded:" + highestPageLoaded)
    if (highestPageLoaded < highestPage){
        // mark initiating immediately so other scroll events won't start a second one
        isInitiatingPageLoad = true;

        currentPage++;
        highestPageLoaded++;
        if (!pagesLoaded.includes(highestPageLoaded)){
            let pageToLoadFrom = ('https://www.flashback.org' + threadId + "p" + (highestPageLoaded));
            // Insert loading separator at the end of posts
            const postsContainer = document.getElementById('posts');
            if (postsContainer && !document.getElementById('loadingPageSeparator')) {
                const loadingSeparator = document.createElement('div');
                loadingSeparator.className = 'pageSeparator';
                loadingSeparator.id = 'loadingPageSeparator';
                loadingSeparator.setAttribute('data-page', highestPageLoaded);
                loadingSeparator.textContent = `Laddar sida ${highestPageLoaded}`;
                loadingSeparator.style.fontSize = '20px';
                loadingSeparator.style.background = '#7a7a7a';
                loadingSeparator.style.color = '#fff';
                loadingSeparator.style.textAlign = 'center';
                loadingSeparator.style.width = '100%';
                postsContainer.appendChild(loadingSeparator);
            }
            fetchPostsFromPage(pageToLoadFrom);
            pagesLoaded.push(highestPageLoaded);
            //console.log("pagesLoaded:"+pagesLoaded);
            history.replaceState(null,'',pageToLoadFrom);
        };
    } else {
        // nothing to load - make sure flags are reset so we don't lock future attempts
        isInitiatingPageLoad = false;
        nextPageLoaded = 0;
    }
}
function initiatePageLoadBackward(){
    startOrEnd='start';
    //console.log("initiatebackward-highest:" + highestPage)
    //console.log("initiatebackward-lowest:" + lowestPageLoaded)
    if (lowestPageLoaded>1){
        currentPage--;
        lowestPageLoaded--;
        if (!pagesLoaded.includes(lowestPageLoaded)){
            let pageToLoadFrom=('https://www.flashback.org'+threadId+"p"+(lowestPageLoaded))
            // Change button text to "Laddar sida X" and disable it
            const btn = document.getElementById('loadLastPageButton');
            if (btn) {
                btn.textContent = `Laddar sida ${lowestPageLoaded}`;
                btn.disabled = true;
                btn.style.opacity = '0.7';
                btn.style.pointerEvents = 'none';
            }
            fetchPostsFromPage(pageToLoadFrom);
            pagesLoaded.push(lowestPageLoaded);
            //console.log("pagesLoaded:"+pagesLoaded);
            history.replaceState(null,'',pageToLoadFrom);
        };
    }
}
function addLoadLastPageButton(){
    document.querySelectorAll('#loadLastPageButton, .load-page-button').forEach(btn => btn.remove());

    const container = document.getElementById('posts');
    if (!container) return;

    const postNodes = Array.from(container.querySelectorAll('.post'));
    if (postNodes.length === 0) return;

    const pageNumbers = postNodes
        .map(p => parseInt(p.getAttribute('pagenumber') || '', 10))
        .filter(n => !isNaN(n));
    if (pageNumbers.length === 0) return;

    const minPage = Math.min(...pageNumbers);

    if (minPage <= 1) return;

    const pageToLoad = minPage - 1;
    const firstOfMin = postNodes.find(p => parseInt(p.getAttribute('pagenumber'), 10) === minPage);
    const insertBeforeNode = firstOfMin || container.firstChild;
    const loadLastPageButton = document.createElement('button');
    loadLastPageButton.id = 'loadLastPageButton';
    loadLastPageButton.className = 'loadLastPageButton load-page-button';
    loadLastPageButton.textContent = 'Ladda sida ' + pageToLoad;
    loadLastPageButton.setAttribute('style', `
        font-size: 20px !important;
        display: block !important;
        width: 100% !important;
        background: #7a7a7a !important;
        text-align: center !important;
        cursor: pointer !important;
        padding: 10px 0 !important;
        box-sizing: border-box !important;
        border: none !important;
        color: #fff !important;
        overflow: visible !important;
        pointer-events: auto !important;
        position: relative !important;
    `);

    loadLastPageButton.addEventListener('click', function() {
        initiatePageLoadBackward();
    });

    container.insertBefore(loadLastPageButton, insertBeforeNode);
}
function setupMutationObserver() {
    const target = document.body;
    if (!target) {
        // retry once DOM is ready
        document.addEventListener("DOMContentLoaded", setupMutationObserver);
        return;
    }

    const observer = new MutationObserver((mutationsList, observer) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                if(bypassLeavingSetting){rewriteLeaveLinks()}
                // No-op: previously called addSubmitQuoteButton, which does not exist
            }
        }
    });

    observer.observe(target, { childList: true, subtree: true });
}

function addFloatingPageDiv() {
    if (threadId.substring(0, 2) === '/t') {
        const floatingDiv = document.createElement('div');
        floatingDiv.id = "floatingDiv";
        floatingDiv.style.position = 'fixed';
        floatingDiv.style.bottom = '10px';
        floatingDiv.style.right = '10px';
        floatingDiv.style.backgroundColor = 'white';
        floatingDiv.style.color = 'white';
        floatingDiv.style.padding = '1px';
        floatingDiv.style.zIndex = '9999';
        floatingDiv.style.alignItems = 'center';
        floatingDiv.style.display = 'flex';
        document.body.appendChild(floatingDiv);
    }
};
function initialAddPageNumberToPostsInDom(initialPageNumber){
    const posts = document.querySelectorAll('div.post');
    posts.forEach(post => {
        post.setAttribute('pagenumber', initialPageNumber);
    });
};

function updateFloatingDiv(navBarNumber){
    let urlFloatinDivToSetUrlBar = ('https://www.flashback.org'+threadId+"p"+(navBarNumber));
    if (threadId.substring(0,2)!=='/t') return;

    const floatingDiv = document.getElementById("floatingDiv");
    if (!floatingDiv) return;

    if (floatingDivPage === navBarNumber && floatingDiv.innerHTML && floatingDiv.innerHTML.length > 0) {
        return;
    }

    const answDiv = document.getElementsByClassName('btn btn-default btn-xs')[0];
    const navBarHtml = navigationBars[navBarNumber];

    if (!navBarHtml || typeof navBarHtml !== 'string' || navBarHtml.length < 1) {
        //console.log("Floating navbar missing or empty for page:", navBarNumber);
        return; 
    }

    floatingDivPage = navBarNumber;
    floatingDiv.innerHTML = (answDiv ? answDiv.outerHTML : '') + navBarHtml;
    //console.log("Updated Floating Div for page:", navBarNumber);
    history.replaceState(null,'',urlFloatinDivToSetUrlBar);
};

function checkPostClosestToWindowCenter() {
    const postsDiv = document.getElementById("posts"); 
    if (!postsDiv) {
        //console.log("Posts div not found!");
        return;
    }
    const postDivs = postsDiv.querySelectorAll("div.post");

    if (postDivs.length === 0) {
        //console.log("No posts found");
        return;
    }
    const windowCenterX = window.innerWidth / 2;
    const windowCenterY = window.innerHeight / 2;

    let closestPost = null;
    let closestDistance = Infinity;

    postDivs.forEach(post => {
        const postRect = post.getBoundingClientRect();
        const postCenterX = postRect.left + postRect.width / 2;
        const postCenterY = postRect.top + postRect.height / 2;
        const distance = Math.sqrt(
            Math.pow(postCenterX - windowCenterX, 2) +
            Math.pow(postCenterY - windowCenterY, 2)
        );

        if (distance < closestDistance) {
            closestDistance = distance;
            closestPost = post;
        }
    });
    if (closestPost) {
        if (parseInt(closestPost.getAttribute("pagenumber"))!=parseInt(floatingDivPage)){
            updateFloatingDiv(closestPost.getAttribute("pagenumber"));
        }
    } else {
        //console.log("No post found");
    }
}

function addPageSeparators(){
    const loadingSep = document.getElementById('loadingPageSeparator');
    if (loadingSep) loadingSep.remove();

    const btn = document.getElementById('loadLastPageButton');
    if (btn && btn.disabled) btn.remove();

    document.querySelectorAll('.pageSeparator').forEach(e => e.remove());

    const posts = Array.from(document.querySelectorAll('.post'));
    if (posts.length === 0) return;

    let lastPage = posts[0].getAttribute('pagenumber') || null;

    for (let i = 1; i < posts.length; i++) {
        const currentPage = posts[i].getAttribute('pagenumber') || null;
        if (!currentPage) continue;

        if (currentPage !== lastPage) {
            const separator = document.createElement('div');
            separator.className = 'pageSeparator';
            separator.setAttribute('data-page', currentPage);
            separator.textContent = `Sida ${currentPage}`;
            separator.style.fontSize = '20px';
            separator.style.background = '#7a7a7a';
            separator.style.color = '#fff';
            separator.style.textAlign = 'center';
            separator.style.width = '100%';
            posts[i].parentNode.insertBefore(separator, posts[i]);
            lastPage = currentPage;
        }
    }
}

function getCookie(name) {
    return document.cookie
        .split("; ")
        .find(row => row.startsWith(name + "="))
        ?.split("=")[1] || "";
}

//this version uses Max-Age instead of Expires, and adds SameSite and Secure attributes - Thank you Mr.RedHat for the suggestion!
function setCookie(name, value, days) {
    let maxAge = "";
    if (days) {
        maxAge = days * 24 * 60 * 60; 
    }
    document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
}

function fixMultiQuote() {
    console.log("fixMultiQuote initialized");

    if (!document._multiQuoteClickBound) {
        document.addEventListener("click", function(e) {
            let btn = e.target.closest(".btn-quote-multiple");
            if (!btn) return;

            e.preventDefault(); 

            let postId = parseInt(btn.dataset.postid);
            if (!postId) return;

            let postMessage = document.querySelector("#post_message_" + postId);
            if (!postMessage) return;

            let qpostids = getCookie("qpostids") ? getCookie("qpostids") + "," : "";
            let postIdsArray = qpostids.split(",");


            postIdsArray = postIdsArray.filter(id => !(postMessage.classList.contains("quotem") && id == postId));

            postMessage.classList.toggle("quotem");

            qpostids = postIdsArray.length ? postIdsArray.join(",") : "";
            if (postMessage.classList.contains("quotem")) {
                qpostids = (qpostids ? qpostids + "," : "") + postId;
            }

            setCookie("qpostids", qpostids, 1);
        });

        document._multiQuoteClickBound = true;
    }

    if (document._multiQuoteObserver) {
        document._multiQuoteObserver.disconnect();
    }

    let observer = new MutationObserver(mutations => {
        for (let mutation of mutations) {
            for (let added of mutation.addedNodes) {
                if (!(added instanceof HTMLElement)) continue;

                added.querySelectorAll?.(".btn-quote-multiple").forEach(btn => {
                    if (!btn.classList.contains("quote-observed")) {
                        btn.classList.add("quote-observed");
                    }
                });

                if (added.matches?.(".btn-quote-multiple")) {
                    if (!added.classList.contains("quote-observed")) {
                        added.classList.add("quote-observed");
                    }
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document._multiQuoteObserver = observer;
}

function loadSaveThreadAndTS() {
    threadId=""
    const threadInfoElement = document.querySelector('.input-page-jump');
    if (threadInfoElement) {
        threadId = threadInfoElement.getAttribute('data-url');
    }

    if (!threadId) {
        const titleLink = document.querySelector('.page-title a[href]');
        if (titleLink) {
            threadId = titleLink.getAttribute('href');
        }
    }

    if (!threadId) {
        const metaOgUrl = document.querySelector('meta[property="og:url"]');
        if (metaOgUrl) {
            const ogContent = metaOgUrl.getAttribute('content');
            const match = ogContent?.match(/\/t\d+/);
            if (match) threadId = match[0];
        }
    }

    if (!threadId || !threadId.startsWith('/t')) {
        threadId = "";
    }

    if (!threadId) return;

    chrome.storage.sync.get(['userStorageFbqolThreadsAndTS'], (result) => {
        const storedList = result.userStorageFbqolThreadsAndTS || [];
        handleThreadAndTS(storedList, threadId);
    });

    function handleThreadAndTS(storedList, threadId) {
        const entry = storedList.find(item => item.threadId === threadId);
        if (entry) {
            //console.log('Found existing entry for threadId:', threadId, 'TS:', entry.TS);
            threadTS = entry.TS;
        }

        if (!threadTS) {
            //console.log('No TS found for threadId:', threadId, '— checking DOM.');
            const firstPostAnchor = document.querySelector('a[name="1"]');
            const postElement = firstPostAnchor?.closest('.post');
            const userElement = postElement?.querySelector('.post-user-username');

            if (userElement) {
                threadTS = userElement.textContent.trim();
                console.log('Found thread starter (TS) in DOM:', threadTS);
                saveThreadTS(threadId, threadTS, storedList);
                if (showTsSetting === true) markTSPostsInDom();
                return;
            }
        }

        // --- If still not found, ask service worker ---
        if (!threadTS) {
            console.log('TS not found in DOM — requesting via service worker...');
            chrome.runtime.sendMessage({ action: 'fetchThreadTS', threadId }, (response) => {
                if (!response) {
                    //console.log("No response from background.");
                    return;
                }

                if (response.error) {
                    //console.log("Background error fetching thread:", response.error);
                    return;
                }

                if (!response.html) {
                    //console.log("Background returned no html for thread:", threadId);
                    return;
                }

                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.html, "text/html");

                    const firstPostAnchor = doc.querySelector('a[name="1"]');
                    const postElement = firstPostAnchor?.closest?.('.post');
                    const userElement = postElement?.querySelector?.('.post-user-username');

                    if (userElement && userElement.textContent) {
                        const fetchedThreadTS = userElement.textContent.trim();
                        console.log("Got TS from fetched HTML:", fetchedThreadTS);
                        threadTS = fetchedThreadTS;
                        chrome.storage.sync.get(['userStorageFbqolThreadsAndTS'], (result) => {
                            const storedList = result.userStorageFbqolThreadsAndTS || [];
                            if (!storedList.some(item => item.threadId === threadId)) {
                                const updatedList = [...storedList, { threadId, TS: threadTS }];
                                chrome.storage.sync.set({ userStorageFbqolThreadsAndTS: updatedList }, () => {
                                    console.log('Saved threadId + TS to sync storage:', { threadId, TS: threadTS });
                                    chrome.storage.local.set({ userStorageFbqolThreadsAndTS: updatedList }, () => {
                                        console.log('Saved threadId + TS to local storage as well.');
                                    });
                                });
                            }
                        });

                        if (showTsSetting === true) {
                            markTSPostsInDom();
                        }
                    } else {
                        //console.warn("Could not find thread starter username in fetched HTML for", threadId);
                    }
                } catch (err) {
                    //console.error("Error parsing fetched HTML:", err);
                }
            });
        }

        if (showTsSetting === true && threadTS) {
            markTSPostsInDom();
        }
    }

    function saveThreadTS(threadId, threadTS, storedList) {
        const exists = storedList.some(item => item.threadId === threadId);
        if (exists) return;

        const updatedList = [...storedList, { threadId, TS: threadTS }];

        chrome.storage.sync.set({ userStorageFbqolThreadsAndTS: updatedList }, () => {

            // Also save to local
            chrome.storage.local.set({ userStorageFbqolThreadsAndTS: updatedList }, () => {
            });
        });
    }
}

function markTSPostsInDom() {
    if (!threadTS) return;

    const usernameElements = document.querySelectorAll('.post-user-username');

    usernameElements.forEach(userEl => {
        const username = userEl.textContent.trim();
        const postRow = userEl.closest('.post-row');
        //const postLeft = userEl.closest('.post-col.post-left');
        const postLeft = postRow.querySelector('.post-user-info.small');
        const postRight = postRow?.querySelector('.post-col.post-right');
        if (!postRow || !postLeft || !postRight) return;

        let tsBadge = postLeft.querySelector('.ts-badge');

        if (username === threadTS) {
            postRight.style.backgroundColor = "rgba(214, 211, 6, 0.05)";
            postRight.style.borderRadius = "6px";
            postRight.style.transition = "all 0.3s ease";

            if (!tsBadge) {
                tsBadge = document.createElement('div');
                tsBadge.className = 'ts-badge';
                tsBadge.textContent = "TS";
                tsBadge.style.display = "inline-block";
                tsBadge.style.padding = "1px 3px";
                tsBadge.style.fontSize = "10px";
                tsBadge.style.fontWeight = "bold";
                tsBadge.style.color = "#000";
                tsBadge.style.backgroundColor = "yellow";
                tsBadge.style.border = "0.5px solid #ccc";
                tsBadge.style.borderRadius = "2px";
                tsBadge.style.pointerEvents = "none";
                tsBadge.style.marginRight = "4px";
                tsBadge.style.marginBottom = "2px";
                tsBadge.style.whiteSpace = "nowrap";

                if (getComputedStyle(postLeft).position === "static") {
                    postLeft.style.position = "relative";
                }

                //postLeft.appendChild(tsBadge);
                postLeft.insertBefore(tsBadge, postLeft.firstChild); 
            }
        } else {
            // Reset non-TS posts
            postRight.style.backgroundColor = "";
            postRight.style.borderRadius = "";
            if (tsBadge) tsBadge.remove();
        }
    });
}
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        // Page restored from cache (Back/Forward)
        try {
            reInitPlugin(); // or just highlightStoredThreads()
        } catch (e) {
            console.error('Error re-initializing plugin on back:', e);
        }
    }
});
function highlightStoredThreads() {
    //console.log("🟦 highlightStoredThreads() called");

    const threadElements = document.querySelectorAll(
        '.thread-title, a[id^="thread_title_"]'
    );
    //console.log("🟦 Found", threadElements.length, "thread elements");

    if (threadElements.length === 0) {
        //console.warn('⚠️ No thread-title elements found on this page.');
        return;
    }

    const getStorage = (callback) => {
        const runCallback = (data) => {
            if (typeof callback === 'function') {
                callback(data || []);
            }
        };

        try {
            // Prefer Chrome sync storage if available
            if (typeof chrome !== 'undefined' && chrome.storage?.sync?.get) {
                chrome.storage.sync.get(['userStorageFbqolThreadsAndTS'], (result) => {
                    if (chrome.runtime?.lastError) {
                        //console.warn('⚠️ chrome.storage.sync error:', chrome.runtime.lastError);
                        // fallback to chrome.storage.local
                        if (chrome.storage?.local?.get) {
                            chrome.storage.local.get(['userStorageFbqolThreadsAndTS'], (res) => {
                                runCallback(res.userStorageFbqolThreadsAndTS || []);
                            });
                        } else {
                            runCallback([]);
                        }
                    } else {
                        runCallback(result.userStorageFbqolThreadsAndTS || []);
                    }
                });
            } 
            // fallback to local storage
            else if (typeof chrome !== 'undefined' && chrome.storage?.local?.get) {
                chrome.storage.local.get(['userStorageFbqolThreadsAndTS'], (result) => {
                    runCallback(result.userStorageFbqolThreadsAndTS || []);
                });
            } 
            else {
                //console.warn('⚠️ No storage API available');
                runCallback([]);
            }
        } catch (error) {
            //console.error('Storage retrieval failed:', error);
            runCallback([]);
        }
    };

    getStorage((storedList) => {
        if (!Array.isArray(storedList)) {
            //console.warn("⚠️ Stored list is not an array:", storedList);
            return;
        }

        //console.log("📋 Stored thread IDs:", storedList.map(i => i.threadId));

        threadElements.forEach((el) => {
            const threadHref = el.getAttribute('href');
            if (!threadHref) return;

            const match = storedList.find(item => item.threadId === threadHref);
            if (match) {
                //console.log("✅ Highlighting thread:", threadHref, "→", match.TS);
                el.style.backgroundColor = 'rgba(188, 196, 205, 0.58)'; //grey
                el.style.borderRadius = '5px';
                el.style.padding = '2px 4px';
            }
        });
    });
}
function SaveDraftInlagg() {
    const textarea = document.getElementById('vB_Editor_001_textarea');
    const threadInput = document.querySelector('input[name="t"]');

    if (!textarea || !threadInput) return;

    const threadId = threadInput.value;
    const draftText = textarea.value.trim();
    if (!draftText) return;

    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.log('chrome.storage not available (probably outside extension context).');
        return;
    }

    try {
        chrome.storage.sync.get(['FbqolThreadReplyDrafts'], (result) => {
            if (chrome.runtime?.lastError) {
                console.log('chrome.storage.sync.get failed:', chrome.runtime.lastError);
                // fallback to local storage
                saveToLocal(threadId, draftText);
                return;
            }

            const storedList = result.FbqolThreadReplyDrafts || [];
            const existingIndex = storedList.findIndex(item => item.threadId === threadId);

            if (existingIndex !== -1) {
                storedList[existingIndex].draft = draftText;
            } else {
                storedList.push({ threadId, draft: draftText });
            }

            chrome.storage.sync.set({ FbqolThreadReplyDrafts: storedList }, () => {
                if (chrome.runtime?.lastError) {
                    console.log('chrome.storage.sync.set failed:', chrome.runtime.lastError);
                    // fallback to local storage
                    saveToLocal(threadId, draftText);
                } else {
                    //console.log(` Draft saved (sync) for thread ${threadId}`);
                }
            });
        });
    } catch (e) {
        console.log('Unexpected storage error:', e);
        saveToLocal(threadId, draftText);
    }

    function saveToLocal(threadId, draftText) {
        try {
            chrome.storage.local.get(['FbqolThreadReplyDrafts'], (res) => {
                const localList = res.FbqolThreadReplyDrafts || [];
                const idx = localList.findIndex(item => item.threadId === threadId);

                if (idx !== -1) {
                    localList[idx].draft = draftText;
                } else {
                    localList.push({ threadId, draft: draftText });
                }

                chrome.storage.local.set({ FbqolThreadReplyDrafts: localList }, () => {
                    if (chrome.runtime?.lastError) {
                        console.log('Local storage set failed:', chrome.runtime.lastError);
                    } else {
                        console.log(`Draft saved (local fallback) for thread ${threadId}`);
                    }
                });
            });
        } catch (err) {
            console.log('Local storage fallback failed:', err);
        }
    }
}

function loadDraftInlagg() {
    const textarea = document.getElementById('vB_Editor_001_textarea');
    const threadInput = document.querySelector('input[name="t"]');

    if (!textarea || !threadInput) return;

    const threadId = threadInput.value;

    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.log('chrome.storage not available (probably outside extension context).');
        return;
    }

    try {
        chrome.storage.sync.get(['FbqolThreadReplyDrafts'], (result) => {
            if (chrome.runtime?.lastError) {
                console.warn('⚠️ chrome.storage.sync.get failed:', chrome.runtime.lastError);
                // fallback to local
                loadFromLocal();
                return;
            }

            const storedList = result.FbqolThreadReplyDrafts || [];
            const found = storedList.find(item => item.threadId === threadId);

            if (found && found.draft) {
                textarea.value = found.draft;
                console.log(`Draft loaded (sync) for thread ${threadId}`);
            } else {
                console.log(` No draft found in sync storage for thread ${threadId}`);
                // Try local storage just in case
                loadFromLocal();
            }
        });
    } catch (e) {
        console.log(' Unexpected sync error:', e);
        loadFromLocal();
    }

    function loadFromLocal() {
        try {
            chrome.storage.local.get(['FbqolThreadReplyDrafts'], (res) => {
                if (chrome.runtime?.lastError) {
                    console.log('chrome.storage.local.get failed:', chrome.runtime.lastError);
                    return;
                }

                const localList = res.FbqolThreadReplyDrafts || [];
                const foundLocal = localList.find(item => item.threadId === threadId);

                if (foundLocal && foundLocal.draft) {
                    textarea.value = foundLocal.draft;
                    console.log(`Draft loaded (local fallback) for thread ${threadId}`);
                } else {
                    console.log(`No draft found in local storage for thread ${threadId}`);
                }
            });
        } catch (err) {
            console.log('Local storage load failed:', err);
        }
    }
}

function addDraftButtonsInlagg() {
    const buttonContainer = document.querySelector('.form-group .col-lg-10.col-lg-offset-2');
    if (!buttonContainer) return;

    // Check if the buttons already exist
    if (!document.getElementById('saveDraftButton')) {
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn btn-info btn-sm';
        saveBtn.id = 'saveDraftButton';
        saveBtn.innerHTML = '<i class="fa fa-floppy-o"></i> Spara utkast';
        saveBtn.style.marginLeft = '8px';
        saveBtn.addEventListener('click', SaveDraftInlagg);

        buttonContainer.appendChild(saveBtn);
    }

    if (!document.getElementById('loadDraftButton')) {
        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'btn btn-warning btn-sm';
        loadBtn.id = 'loadDraftButton';
        loadBtn.innerHTML = '<i class="fa fa-upload"></i> Ladda utkast';
        loadBtn.style.marginLeft = '8px';
        loadBtn.addEventListener('click', loadDraftInlagg);

        buttonContainer.appendChild(loadBtn);
    }
}

function saveAndLoadDraft() { // function to save and load drafts in threads
    const url = window.location.href;
    if (url.startsWith("https://www.flashback.org/newreply.php") || 
        url.startsWith("http://www.flashback.org/newreply.php")) {
        console.log("inläggssida");
        addDraftButtonsInlagg();
    } 
    else if (url.startsWith("https://www.flashback.org/newthread.php") || 
        url.startsWith("http://www.flashback.org/newthread.php")) {
            // Case 2: Relative path version
            console.log("ny tråd");     
            addDraftButtonsThread();
    }
}

function addDraftButtonsThread() {
    const buttonContainer = document.querySelector('.col-sm-10.col-sm-offset-2');
    if (!buttonContainer) return;

    // Only create "Spara" button if it doesn't exist
    if (!document.getElementById('saveThreadDraftButton')) {
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn btn-info btn-sm';
        saveBtn.id = 'saveThreadDraftButton';
        saveBtn.innerHTML = '<i class="fa fa-floppy-o"></i> Spara utkast';
        saveBtn.style.marginLeft = '8px';
        saveBtn.addEventListener('click', SaveDraftThread);

        buttonContainer.appendChild(saveBtn);
    }

    // Only create "Ladda" button if it doesn't exist
    if (!document.getElementById('loadThreadDraftButton')) {
        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'btn btn-warning btn-sm';
        loadBtn.id = 'loadThreadDraftButton';
        loadBtn.innerHTML = '<i class="fa fa-upload"></i> Ladda utkast';
        loadBtn.style.marginLeft = '8px';
        loadBtn.addEventListener('click', loadDraftThread);

        buttonContainer.appendChild(loadBtn);
    }
}

function SaveDraftThread() {
    const textarea = document.getElementById('vB_Editor_001_textarea');
    const subjectInput = document.querySelector('input[name="subject"]');
    if (!textarea) return;

    // Get draft name from subject input, fallback to prompt
    let draftName = subjectInput?.value.trim();
    if (!draftName) {
        draftName = prompt('Ange namn för utkastet:');
        if (!draftName) return;
    }

    const draftText = textarea.value.trim();
    if (!draftText) return;

    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.log('chrome.storage not available.');
        return;
    }

    try {
        chrome.storage.sync.get(['FbqolNewThreadDrafts'], (result) => {
            if (chrome.runtime?.lastError) {
                console.warn('chrome.storage.sync.get failed, fallback to local:', chrome.runtime.lastError);
                saveToLocal();
                return;
            }

            const storedList = result.FbqolNewThreadDrafts || [];
            const existingIndex = storedList.findIndex(item => item.name === draftName);

            if (existingIndex !== -1) {
                storedList[existingIndex].draft = draftText;
            } else {
                storedList.push({ name: draftName, draft: draftText });
            }

            chrome.storage.sync.set({ FbqolNewThreadDrafts: storedList }, () => {
                if (chrome.runtime?.lastError) saveToLocal();
                else console.log(`Draft saved (sync) under name "${draftName}"`);
            });
        });
    } catch (e) {
        console.warn('Unexpected sync error:', e);
        saveToLocal();
    }

    function saveToLocal() {
        try {
            chrome.storage.local.get(['FbqolNewThreadDrafts'], (res) => {
                const localList = res.FbqolNewThreadDrafts || [];
                const idx = localList.findIndex(item => item.name === draftName);
                if (idx !== -1) localList[idx].draft = draftText;
                else localList.push({ name: draftName, draft: draftText });
                chrome.storage.local.set({ FbqolNewThreadDrafts: localList }, () => {
                    if (chrome.runtime?.lastError) console.warn('Local storage set failed:', chrome.runtime.lastError);
                    else console.log(`Draft saved (local fallback) under name "${draftName}"`);
                });
            });
        } catch (err) {
            console.warn('Local storage fallback failed:', err);
        }
    }
}

function loadDraftThread() {
    const textarea = document.getElementById('vB_Editor_001_textarea');
    if (!textarea) return;

    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.log('chrome.storage not available.');
        return;
    }

    function showDraftSelector(list, source) {
        if (!list.length) {
            console.log(`No drafts found in ${source} storage.`);
            return;
        }

        // Remove existing modal if present
        const existingModal = document.getElementById('draftSelectorModal');
        if (existingModal) existingModal.remove();

        // Create modal background
        const modalBg = document.createElement('div');
        modalBg.id = 'draftSelectorModal';
        modalBg.style.position = 'fixed';
        modalBg.style.top = '0';
        modalBg.style.left = '0';
        modalBg.style.width = '100%';
        modalBg.style.height = '100%';
        modalBg.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modalBg.style.display = 'flex';
        modalBg.style.alignItems = 'center';
        modalBg.style.justifyContent = 'center';
        modalBg.style.zIndex = '9999';

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = '#fff';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '8px';
        modalContent.style.minWidth = '300px';
        modalContent.style.maxHeight = '70%';
        modalContent.style.overflowY = 'auto';

        const title = document.createElement('h4');
        title.innerText = 'Välj utkast att ladda';
        modalContent.appendChild(title);

        list.forEach(item => {
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.margin = '5px 0';

            const btn = document.createElement('button');
            btn.textContent = item.name;
            btn.style.flexGrow = '1';
            btn.style.padding = '5px 10px';
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', () => {
                textarea.value = item.draft || '';
                console.log(`Draft loaded from ${source} storage under name "${item.name}"`);
                modalBg.remove();
            });

            const delBtn = document.createElement('button');
            delBtn.textContent = 'X';
            delBtn.style.marginLeft = '5px';
            delBtn.style.backgroundColor = 'red';
            delBtn.style.color = '#fff';
            delBtn.style.border = 'none';
            delBtn.style.cursor = 'pointer';
            delBtn.style.padding = '0 8px';
            delBtn.style.borderRadius = '4px';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent loading draft
                // Remove from storage
                const storageKey = source === 'sync' ? chrome.storage.sync : chrome.storage.local;
                const newList = list.filter(d => d.name !== item.name);
                const data = source === 'sync' ? { FbqolNewThreadDrafts: newList } : { FbqolNewThreadDrafts: newList };
                storageKey.set(data, () => {
                    if (chrome.runtime?.lastError) {
                        console.warn(`Failed to delete draft "${item.name}" from ${source}:`, chrome.runtime.lastError);
                    } else {
                        console.log(`Deleted draft "${item.name}" from ${source} storage`);
                        container.remove(); // remove from modal
                    }
                });
            });

            container.appendChild(btn);
            container.appendChild(delBtn);
            modalContent.appendChild(container);
        });

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Avbryt';
        closeBtn.style.marginTop = '10px';
        closeBtn.style.padding = '5px 10px';
        closeBtn.addEventListener('click', () => modalBg.remove());
        modalContent.appendChild(closeBtn);

        modalBg.appendChild(modalContent);
        document.body.appendChild(modalBg);
    }

    try {
        chrome.storage.sync.get(['FbqolNewThreadDrafts'], (result) => {
            if (chrome.runtime?.lastError) {
                console.warn('chrome.storage.sync.get failed, fallback to local:', chrome.runtime.lastError);
                loadFromLocal();
                return;
            }

            const storedList = result.FbqolNewThreadDrafts || [];
            if (storedList.length) {
                showDraftSelector(storedList, 'sync');
            } else {
                loadFromLocal();
            }
        });
    } catch (e) {
        console.warn('Unexpected sync error:', e);
        loadFromLocal();
    }

    function loadFromLocal() {
        try {
            chrome.storage.local.get(['FbqolNewThreadDrafts'], (res) => {
                if (chrome.runtime?.lastError) return console.warn('Local storage get failed:', chrome.runtime.lastError);
                const localList = res.FbqolNewThreadDrafts || [];
                if (localList.length) showDraftSelector(localList, 'local');
            });
        } catch (err) {
            console.warn('Local storage load failed:', err);
        }
    }
}

function searchLinks() {
    // --------------------------
    // Button 1: Next to dropdown
    // --------------------------
    const postsDiv = document.getElementById('posts');
    if (postsDiv) {
        const outerGroup = document.querySelector('.btn-group.btn-group-xs');
        if (outerGroup) {
            const dropdownBtn = outerGroup.querySelector('a.dropdown-toggle.btn.btn-default.btn-xs');
            if (dropdownBtn && !outerGroup.querySelector('#searchLinks')) {
                const searchBtn = document.createElement('a');
                searchBtn.classList.add('btn', 'btn-default', 'btn-xs');
                searchBtn.id = 'searchLinks';
                searchBtn.href = '#';
                searchBtn.rel = 'nofollow';
                searchBtn.setAttribute('role', 'button');
                searchBtn.textContent = 'Kattskrälle extension - Sök länkar i tråd';
                searchBtn.style.whiteSpace = 'nowrap';
                searchBtn.style.setProperty('background', '#7a7a7a', 'important');
                searchBtn.style.setProperty('color', '#fff', 'important');

                searchBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (typeof showSearchLinksInThreadMenu === 'function') {
                        showSearchLinksInThreadMenu();
                    } else {
                        console.warn('showSearchLinksInThreadMenu() is not defined.');
                    }
                });
                dropdownBtn.insertAdjacentElement('afterend', searchBtn);
            }
        }
    }

     if (postsDiv) {
        const dropdownSearch = document.getElementById('dropdown-search');
        if (dropdownSearch && !document.getElementById('searchLinks2')) {
            const searchBtn2 = document.createElement('button');
            searchBtn2.id = 'searchLinks2';
            searchBtn2.type = 'button';
            searchBtn2.classList.add('btn', 'btn-sm', 'btn-warning');
            searchBtn2.textContent = 'Kattskrälle extension - Sök länkar i tråd';

            searchBtn2.addEventListener('click', function (e) {
                e.preventDefault();
                if (typeof showSearchLinksInThreadMenu === 'function') {
                    showSearchLinksInThreadMenu();
                } else {
                    console.warn('showSearchLinksInThreadMenu() is not defined.');
                }
            });
            searchBtn2.style.fontSize = '12px';
            searchBtn2.style.display = 'block';
            searchBtn2.style.width = '100%';
            searchBtn2.style.background = '#7a7a7a';
            searchBtn2.style.color = '#fff';
            searchBtn2.style.textAlign = 'center';
            searchBtn2.style.cursor = 'pointer';
            searchBtn2.style.padding = '6px 0';
            searchBtn2.style.boxSizing = 'border-box';
            searchBtn2.style.border = 'none';
            searchBtn2.style.position = 'relative';
            searchBtn2.style.overflow = 'visible';
            searchBtn2.style.pointerEvents = 'auto';
            // Append at the end of #dropdown-search
            dropdownSearch.appendChild(searchBtn2);
        }
    }
}

function showSearchLinksInThreadMenu() {
    // Ensure necessary thread info is set
    if (typeof threadId === 'undefined' || typeof highestPage === 'undefined' || !threadId || !highestPage) {
        getThreadInfo();
    }

    const searchBtn = document.getElementById('searchLinks'); 
    const searchBtnDropdown = document.getElementById('searchLinks2');
    if (!searchBtn && !searchBtnDropdown) return;

    const postsDiv = document.getElementById('posts');
    const paginationULs = document.querySelectorAll('ul.pagination.pagination-xs');
    const replyBtns = document.querySelectorAll('div.btn-group a.btn.btn-default.btn-xs[href*="/newreply.php"]');

    let toggleDiv = document.querySelector('.kattskralle-search-div');

    function closeToggleDiv() {
        if (!toggleDiv) return;
        toggleDiv.remove();
        if (postsDiv) postsDiv.style.display = '';
        paginationULs.forEach(ul => ul.style.display = '');
        replyBtns.forEach(btn => btn.style.display = '');
        if (searchBtn) searchBtn.textContent = 'Kattskrälle extension - Sök länkar i tråd';
        if (searchBtnDropdown) searchBtnDropdown.textContent = 'Kattskrälle extension - Sök länkar i tråd';
    }

    if (toggleDiv) {
        closeToggleDiv();
    } else {
        if (postsDiv) postsDiv.style.display = 'none';
        paginationULs.forEach(ul => ul.style.display = 'none');
        replyBtns.forEach(btn => btn.style.display = 'none');

        toggleDiv = document.createElement('div');
        toggleDiv.classList.add('kattskralle-search-div');
        toggleDiv.style.cssText = 'position:relative; margin:10px 0; padding:10px; border:1px solid #ccc; background-color:#f9f9f9;';

        const titleP = document.createElement('p');
        titleP.textContent = 'Kattskrälle - Sök länkar i tråd';
        titleP.style.cssText = 'font-weight:bold; margin:0 0 8px 0; font-size:1em;';
        toggleDiv.appendChild(titleP);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        closeBtn.style.cssText = `
            position:absolute; top:5px; right:5px; border:1px solid red; background:white;
            color:red; cursor:pointer; font-weight:bold; font-size:14px; line-height:14px;
            width:20px; height:20px; text-align:center; padding:0; border-radius:2px;
        `;
        closeBtn.title = 'Stäng';
        closeBtn.addEventListener('click', closeToggleDiv);
        toggleDiv.appendChild(closeBtn);

        const segment1 = document.createElement('div');
        segment1.style.cssText = 'border:1px solid #ccc; border-radius:3px; padding:6px; margin-bottom:6px; background:#fff;';
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns:auto 1fr; gap:4px 6px; align-items:center; max-width:300px;';

        const labelThread = document.createElement('label');
        labelThread.textContent = 'TrådID:';
        labelThread.style.fontWeight = 'bold';
        labelThread.setAttribute('for','threadId');

        const inputThread = document.createElement('input');
        inputThread.type = 'text';
        inputThread.id = 'threadId';
        inputThread.name = 'threadId';
        inputThread.value = threadId || '';
        inputThread.readOnly = true;
        inputThread.style.cssText = 'padding:2px 4px; border:1px solid #bbb; border-radius:3px; width:100%;';
        inputThread.style.backgroundColor = '#eee'; 

        const labelFrom = document.createElement('label');
        labelFrom.textContent = 'Från Sida:';
        labelFrom.style.fontWeight = 'bold';
        labelFrom.setAttribute('for','fromPage');

        const inputFrom = document.createElement('input');
        inputFrom.type = 'number';
        inputFrom.id = 'fromPage';
        inputFrom.name = 'fromPage';
        inputFrom.value = 1;
        inputFrom.min = 1;
        inputFrom.max = highestPage || 1;
        inputFrom.style.cssText = 'padding:2px 4px; border:1px solid #bbb; border-radius:3px; width:100%;';
        inputFrom.addEventListener('input', () => {
            if (parseInt(inputFrom.value) > highestPage) inputFrom.value = highestPage;
        });

        const labelTo = document.createElement('label');
        labelTo.textContent = 'Till Sida:';
        labelTo.style.fontWeight = 'bold';
        labelTo.setAttribute('for','toPage');

        const inputTo = document.createElement('input');
        inputTo.type = 'number';
        inputTo.id = 'toPage';
        inputTo.name = 'toPage';
        inputTo.value = highestPage || 1;
        inputTo.min = 1;
        inputTo.max = highestPage || 1;
        inputTo.style.cssText = 'padding:2px 4px; border:1px solid #bbb; border-radius:3px; width:100%;';
        inputTo.addEventListener('input', () => {
            if (parseInt(inputTo.value) > highestPage) inputTo.value = highestPage;
        });

        grid.append(labelThread,inputThread,labelFrom,inputFrom,labelTo,inputTo);
        segment1.appendChild(grid);
        toggleDiv.appendChild(segment1);

        // --- Segment 2: Checkboxes & Buttons ---
        const segment2 = document.createElement('div');
        segment2.style.cssText = 'border:1px solid #ccc; border-radius:3px; padding:6px; margin-bottom:6px; background:#fff;';
        const checkboxContainer = document.createElement('div');
        checkboxContainer.style.cssText='display:flex; gap:6px; flex-wrap:wrap;';

        // Safe / unsafe mode
        const checkboxSafeBox = document.createElement('div');
        checkboxSafeBox.style.cssText='display:flex; flex-direction:column; gap:2px; min-width:180px; border:1px solid #ccc; border-radius:3px; padding:4px; background:#fefefe;';
        const safeP = document.createElement('p'); safeP.textContent='Sökläge'; safeP.style.cssText='margin:0 0 2px 0; font-weight:bold;';
        const safeLabel = document.createElement('label'); safeLabel.style.cssText='display:flex; align-items:center; gap:4px;';
        const safeCheckbox = document.createElement('input'); safeCheckbox.type='checkbox'; safeCheckbox.id='safeMode'; safeCheckbox.checked=true;
        safeLabel.appendChild(safeCheckbox); safeLabel.appendChild(document.createTextNode('Säkert läge - Långsammare men rekommenderat'));
        const unsafeLabel = document.createElement('label'); unsafeLabel.style.cssText='display:flex; align-items:center; gap:4px;';
        const unsafeCheckbox = document.createElement('input'); unsafeCheckbox.type='checkbox'; unsafeCheckbox.id='unsafeMode';
        unsafeLabel.appendChild(unsafeCheckbox); unsafeLabel.appendChild(document.createTextNode('Osäkert läge - Snabbare men risk för IP-blockering'));
        checkboxSafeBox.append(safeP,safeLabel,unsafeLabel);

        // Result format
        const checkboxResultBox = document.createElement('div');
        checkboxResultBox.style.cssText='display:flex; flex-direction:column; gap:2px; min-width:180px; border:1px solid #ccc; border-radius:3px; padding:4px; background:#fefefe;';
        const resultP = document.createElement('p'); resultP.textContent='Resultat format'; resultP.style.cssText='margin:0 0 2px 0; font-weight:bold;';
        const linkOnlyLabel = document.createElement('label'); linkOnlyLabel.style.cssText='display:flex; align-items:center; gap:4px;';
        const linkOnlyCheckbox = document.createElement('input'); linkOnlyCheckbox.type='checkbox'; linkOnlyCheckbox.id='linkOnly'; linkOnlyCheckbox.checked=true;
        linkOnlyLabel.appendChild(linkOnlyCheckbox); linkOnlyLabel.appendChild(document.createTextNode('Endast länkar'));
        const fullPostLabel = document.createElement('label'); fullPostLabel.style.cssText='display:flex; align-items:center; gap:4px;';
        const fullPostCheckbox = document.createElement('input'); fullPostCheckbox.type='checkbox'; fullPostCheckbox.id='fullPost';
        fullPostLabel.appendChild(fullPostCheckbox); fullPostLabel.appendChild(document.createTextNode('Hela inlägg'));
        checkboxResultBox.append(resultP,linkOnlyLabel,fullPostLabel);

        // Flashback links
        const checkboxFlashbackBox = document.createElement('div');
        checkboxFlashbackBox.style.cssText = 'display:flex; flex-direction:column; gap:2px; min-width:180px; border:1px solid #ccc; border-radius:3px; padding:4px; background:#fefefe;';
        const flashbackP = document.createElement('p'); flashbackP.textContent = 'Flashback-länkar'; flashbackP.style.cssText = 'margin:0 0 2px 0; font-weight:bold;';

        const hideFlashbackLabel = document.createElement('label'); 
        hideFlashbackLabel.style.cssText = 'display:flex; align-items:center; gap:4px;';
        const hideFlashbackCheckbox = document.createElement('input'); 
        hideFlashbackCheckbox.type = 'checkbox'; 
        hideFlashbackCheckbox.id = 'hideFlashback'; 
        hideFlashbackCheckbox.checked = true;
        hideFlashbackLabel.appendChild(hideFlashbackCheckbox);
        hideFlashbackLabel.appendChild(document.createTextNode('Visa inte Flashback-länkar'));

        const showFlashbackLabel = document.createElement('label'); 
        showFlashbackLabel.style.cssText = 'display:flex; align-items:center; gap:4px;';
        const showFlashbackCheckbox = document.createElement('input'); 
        showFlashbackCheckbox.type = 'checkbox'; 
        showFlashbackCheckbox.id = 'showFlashback'; 
        showFlashbackCheckbox.checked = false;
        showFlashbackLabel.appendChild(showFlashbackCheckbox);
        showFlashbackLabel.appendChild(document.createTextNode('Visa Flashback-länkar'));

        hideFlashbackCheckbox.addEventListener('change',()=>{if(hideFlashbackCheckbox.checked) showFlashbackCheckbox.checked=false;});
        showFlashbackCheckbox.addEventListener('change',()=>{if(showFlashbackCheckbox.checked) hideFlashbackCheckbox.checked=false;});

        checkboxFlashbackBox.append(flashbackP, hideFlashbackLabel, showFlashbackLabel);

        checkboxContainer.append(checkboxSafeBox,checkboxResultBox,checkboxFlashbackBox);
        segment2.appendChild(checkboxContainer);

        // Buttons
        const btnDiv = document.createElement('div'); btnDiv.style.cssText='display:flex; gap:6px; margin:6px 0;';
        const startBtn = document.createElement('button'); startBtn.id='startButton'; startBtn.textContent='Starta sökning';
        const cancelBtn = document.createElement('button'); cancelBtn.id='cancelButton'; cancelBtn.textContent='Avbryt';
        startBtn.addEventListener('click', startSearchLinksInThread);
        cancelBtn.addEventListener('click', closeToggleDiv);
        btnDiv.append(startBtn,cancelBtn);
        segment2.appendChild(btnDiv);

        // Activity
        const activityDiv = document.createElement('div'); activityDiv.style.cssText='border:1px solid #ccc; border-radius:3px; padding:4px; background:#fefefe;';
        const activityP = document.createElement('p'); activityP.id='activityText'; activityP.textContent='Aktivitet: Söker igenom sida 0 av 0 efter länkar.'; 
        activityDiv.id='activityDiv';
        activityP.style.cssText='margin:0 0 2px 0; font-size:0.9em;';
        const progressBar = document.createElement('div'); progressBar.style.cssText='width:100%; background-color:#eee; border-radius:3px; overflow:hidden; height:14px;';
        const progressInner = document.createElement('div'); progressInner.id='progressBar'; progressInner.style.cssText='height:100%; width:0%; background-color:#4caf50; transition:width 0.2s;';
        progressBar.appendChild(progressInner); activityDiv.append(activityP,progressBar);
        segment2.appendChild(activityDiv);

        toggleDiv.appendChild(segment2);

        // --- Segment 3: Results ---
        const segment3 = document.createElement('div'); 
        segment3.style.cssText = 'border:1px solid #ccc; border-radius:3px; padding:6px; background:#fff; margin-bottom:6px;';

        const resultatP = document.createElement('p'); 
        resultatP.textContent = 'Resultat:'; 
        resultatP.style.cssText = 'margin:0 0 2px 0; font-weight:bold;';
        segment3.appendChild(resultatP);

        segment3.id = 'resultSegment';

        const resultBtnDiv = document.createElement('div'); 
        resultBtnDiv.style.cssText = 'display:flex; gap:6px; margin-top:4px;';

        const saveTxtBtn = document.createElement('button'); 
        saveTxtBtn.id = 'saveTxtButton'; 
        saveTxtBtn.textContent = 'Spara länkar till .txt-fil';

        // **Add click listener to call your function**
        saveTxtBtn.addEventListener('click', function(e) {
            e.preventDefault();
            saveResultsToTxt();
        });

        const saveHtmlBtn = document.createElement('button'); 
        saveHtmlBtn.id = 'saveHtmlButton'; 
        saveHtmlBtn.textContent = 'Spara resultat till .HTML-fil';
        saveHtmlBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof saveResultsToHtml === 'function') {
                saveResultsToHtml();
            } else {
                console.warn('saveResultsToHtml() is not defined.');
            }
        });
        resultBtnDiv.append(saveTxtBtn, saveHtmlBtn);
        segment3.appendChild(resultBtnDiv);

        const resultatDiv = document.createElement('div'); 
        resultatDiv.id = 'resultat';
        resultatDiv.style.cssText = 'border:1px solid #ccc; border-radius:3px; padding:4px; min-height:40px; background:#fff; font-size:0.9em;';
        segment3.appendChild(resultatDiv);
        toggleDiv.appendChild(segment3);

        // Mutually exclusive checkboxes
        safeCheckbox.addEventListener('change',()=>{if(safeCheckbox.checked) unsafeCheckbox.checked=false;});
        unsafeCheckbox.addEventListener('change',()=>{if(unsafeCheckbox.checked) safeCheckbox.checked=false;});
        linkOnlyCheckbox.addEventListener('change',()=>{if(linkOnlyCheckbox.checked) fullPostCheckbox.checked=false;});
        fullPostCheckbox.addEventListener('change',()=>{if(fullPostCheckbox.checked) linkOnlyCheckbox.checked=false;});

        if(postsDiv){ postsDiv.parentNode.insertBefore(toggleDiv,postsDiv); }
        else { document.body.insertBefore(toggleDiv,document.body.firstChild); }

        // Toggle both button texts
        if (searchBtn) searchBtn.textContent = 'Göm Kattskrälle extension - Sök länkar i tråd';
        if (searchBtnDropdown) searchBtnDropdown.textContent = 'Göm Kattskrälle extension - Sök länkar i tråd';

        const activityDivEl = document.getElementById('activityDiv');
        if (activityDivEl) activityDivEl.style.display = 'none';
        const resultSegmentEl = document.getElementById('resultSegment');
        if (resultSegmentEl) resultSegmentEl.style.display = 'none';
    }
}

function saveResultsToHtml() {
    const resultatDiv = document.getElementById('resultat');
    if (!resultatDiv) return;

    const cloneDiv = resultatDiv.cloneNode(true);

    cloneDiv.querySelectorAll('.post ul.dropdown-menu').forEach(menu => menu.remove());

    cloneDiv.querySelectorAll('.post a').forEach(link => {
        const textNode = document.createTextNode(link.textContent);
        link.replaceWith(textNode);
    });

    cloneDiv.querySelectorAll('.post').forEach(post => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('collapsible-post');

        const postContent = document.createElement('div');
        postContent.classList.add('post-content');
        postContent.style.maxHeight = '5em';
        postContent.style.overflow = 'hidden';
        postContent.style.position = 'relative';

        post.parentNode.insertBefore(wrapper, post);
        postContent.appendChild(post);
        wrapper.appendChild(postContent);

        const fade = document.createElement('div');
        fade.classList.add('fade-overlay');
        fade.style.cssText = `
            position:absolute; bottom:0; left:0; right:0;
            height:2em; background: linear-gradient(rgba(255,255,255,0), #fff);
            pointer-events:none;
        `;
        postContent.appendChild(fade);

        const btn = document.createElement('button');
        btn.textContent = 'Visa mer';
        btn.classList.add('toggle-btn');
        wrapper.appendChild(btn);
    });

    const style = `
    body { font-family: Arial, sans-serif; padding: 10px; background: #fefefe; }
    .collapsible-post { margin-bottom: 12px; border: 1px solid #ccc; border-radius: 4px; padding: 6px; background: #fff; position: relative; }
    .collapsible-post button.toggle-btn { cursor: pointer; padding: 2px 6px; border: 1px solid #888; background: #eee; border-radius: 2px; margin-top:4px; }
    .collapsible-post .post-content { transition: max-height 0.3s ease; overflow: hidden; position: relative; }
    .collapsible-post .fade-overlay { pointer-events: none; }
    a { color: blue; text-decoration: underline; }
    `;

    const script = `
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.collapsible-post').forEach(wrapper => {
            const btn = wrapper.querySelector('button.toggle-btn');
            const content = wrapper.querySelector('.post-content');
            const fade = wrapper.querySelector('.fade-overlay');
            btn.addEventListener('click', () => {
                if (content.style.maxHeight === 'none') {
                    content.style.maxHeight = '5em';
                    fade.style.display = 'block';
                    btn.textContent = 'Visa mer';
                } else {
                    content.style.maxHeight = 'none';
                    fade.style.display = 'none';
                    btn.textContent = 'Minimera';
                }
            });
        });
    });
    `;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>Saved Results</title>
    <style>${style}</style>
    </head>
    <body>
    ${cloneDiv.innerHTML}
    <script>${script}</script>
    </body>
    </html>
    `;

    const threadIdEl = document.getElementById('threadId');
    const fromPageEl = document.getElementById('fromPage');
    const toPageEl = document.getElementById('toPage');

    const threadId = threadIdEl ? threadIdEl.value.replace(/\//g, '') : 'unknownThread';
    const fromPage = fromPageEl ? fromPageEl.value : 'unknownFrom';
    const toPage = toPageEl ? toPageEl.value : 'unknownTo';

    const filename = `results-kattskrälle-${threadId}-${fromPage}-${toPage}.html`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


function saveResultsToTxt() {
    const resultatDiv = document.getElementById('resultat');
    if (!resultatDiv) return;

    const links = Array.from(resultatDiv.querySelectorAll('a')).filter(link => !link.closest('.post'));

    if (links.length === 0) {
        alert('Inga länkar hittades att spara.');
        return;
    }

    let txtContent = '';
    links.forEach(link => {
        txtContent += link.href + '\n';
    });

    const threadIdEl = document.getElementById('threadId');
    const fromPageEl = document.getElementById('fromPage');
    const toPageEl = document.getElementById('toPage');

    let threadId = threadIdEl ? threadIdEl.value.replace(/\//g, '') : 'unknownThread';
    let fromPage = fromPageEl ? fromPageEl.value : 'unknownFrom';
    let toPage = toPageEl ? toPageEl.value : 'unknownTo';

    const filename = `links-kattskrälle-${threadId}-${fromPage}-${toPage}.txt`;

    const blob = new Blob([txtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


async function startSearchLinksInThread() {
    searchCancelled = false;

    const startBtn = document.getElementById('startButton');
    if (startBtn) startBtn.style.display = 'none';

    const inputFrom = document.getElementById('fromPage');
    const inputTo = document.getElementById('toPage');
    if (inputFrom) { inputFrom.disabled = true; inputFrom.style.backgroundColor = '#eee'; }
    if (inputTo) { inputTo.disabled = true; inputTo.style.backgroundColor = '#eee'; }

    const safeCheckbox = document.getElementById('safeMode');
    const unsafeCheckbox = document.getElementById('unsafeMode');
    const linkOnlyCheckbox = document.getElementById('linkOnly');
    const fullPostCheckbox = document.getElementById('fullPost');
    const hideFlashbackCheckbox = document.getElementById('hideFlashback');
    const showFlashbackCheckbox = document.getElementById('showFlashback');
    [safeCheckbox, unsafeCheckbox, linkOnlyCheckbox, fullPostCheckbox, hideFlashbackCheckbox, showFlashbackCheckbox].forEach(cb => { if(cb) cb.disabled = true; });

    const activityDiv = document.getElementById('activityDiv');
    if(activityDiv) activityDiv.style.display = '';

    const resultSegment = document.getElementById('resultSegment');
    if(resultSegment) resultSegment.style.display = '';

    const activityText = document.getElementById('activityText');
    const resultatDiv = document.getElementById('resultat');
    const progressBar = document.getElementById('progressBar');

    const threadId = document.getElementById('threadId').value.trim();
    const fromPage = parseInt(inputFrom.value) || 1;
    const toPage = parseInt(inputTo.value) || 1;

    const totalPages = Math.max(1, toPage - fromPage + 1);
    const hideFlashback = hideFlashbackCheckbox && hideFlashbackCheckbox.checked;
    const fullPostMode = fullPostCheckbox && fullPostCheckbox.checked;
    const hits = [];
    const shownPosts = new Set();

    const cancelBtn = document.getElementById('cancelButton');
    if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.onclick = () => {
            searchCancelled = true;
            cancelBtn.disabled = true;
            if (activityText) activityText.textContent = 'Sökning avbruten av användaren.';
        };
    }

    function cleanLeaveLink(href) {
        if (!href) return null;
        try {
            const url = new URL(href, location.origin);
            if (url.pathname.includes('leave.php') && url.searchParams.has('u')) {
                return decodeURIComponent(url.searchParams.get('u'));
            }
        } catch(e) {}
        return href;
    }

    function isInsideQuote(el) {
        let node = el;
        while (node && node !== document) {
            if (node.nodeType === 1) { 
                const tag = (node.tagName || '').toUpperCase();
                if (tag === 'BLOCKQUOTE') return true;
                const cls = node.className || '';
                if (typeof cls === 'string' && /quote/i.test(cls)) return true;
                if (cls.includes('post-bbcode-quote') || cls.includes('post-bbcode-quote-wrapper') || cls.includes('post-clamped-text')) {
                    return true;
                }
            }
            node = node.parentElement;
        }
        return false;
    }

    if (progressBar) progressBar.style.width = '0%';

    for (let page = fromPage; page <= toPage; page++) {
        if (searchCancelled) break;

        const kattsDiv = document.querySelector('.kattskralle-search-div');
        if (!kattsDiv || kattsDiv.offsetParent === null) {
            searchCancelled = true;
            if (activityText) activityText.textContent = 'Sökning stoppad (Kattskrälle-fönster stängt).';
            break;
        }

        const progress = Math.round(((page - fromPage) / totalPages) * 100);
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (activityText) activityText.textContent = `Aktivitet: Söker igenom sida ${page} av ${toPage} efter länkar.`;

        const url = `https://www.flashback.org/${threadId}p${page}`;
        try {
            const response = await fetch(url, { credentials: 'include' });
            if (!response.ok) throw new Error(`Error fetching page ${page}`);

            // 🔹 Debug log for each fetched page
            //console.log(`Fetched page ${page}: ${url}`);

            const arrayBuffer = await response.arrayBuffer();
            const decoder = new TextDecoder('iso-8859-1');
            const html = decoder.decode(arrayBuffer);
            if (searchCancelled) break;

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const postMessages = doc.querySelectorAll('#posts .post .post_message');
            postMessages.forEach(msg => {
                if (searchCancelled) return;

                const postElement = msg.closest('.post');
                if (!postElement) return;
                const postId = postElement.id || (`post_${Math.random().toString(36).slice(2)}`);

                const anchors = Array.from(msg.querySelectorAll('a[href]'))
                    .filter(a => {
                        if (!a) return false;
                        if (isInsideQuote(a)) return false;
                        if (a.closest('.signature')) return false;
                        if (a.closest('.FBQOLPreview')) return false;
                        return true;
                    });

                if (anchors.length === 0) return;

                const postLinks = [];
                anchors.forEach(a => {
                    let href = a.getAttribute('href');
                    if (!href) return;
                    if (/^\/p\d+/.test(href)) return;
                    href = cleanLeaveLink(href);
                    if (hideFlashback && href.includes('flashback.org')) return;
                    if (href && !postLinks.includes(href)) postLinks.push(href);
                });

                if (postLinks.length === 0) return;
                if (shownPosts.has(postId)) return;
                shownPosts.add(postId);

                if (resultatDiv) {
                    const wrapper = document.createElement('div');
                    wrapper.style.wordBreak = 'break-word';
                    wrapper.style.marginBottom = '15px';

                    postLinks.forEach(href => {
                        if (!hits.includes(href)) hits.push(href);
                        const linkEl = document.createElement('div');
                        linkEl.innerHTML = `<a href="${href}" target="_blank" rel="noreferrer noopener">${href}</a>`;
                        wrapper.appendChild(linkEl);
                    });

                    if (fullPostMode) {
                        const clonedPost = postElement.cloneNode(true);
                        const nestedQuotes = clonedPost.querySelectorAll('.post-bbcode-quote, .post-bbcode-quote-wrapper, .post-clamped-text, blockquote');
                        nestedQuotes.forEach(nq => nq.remove());
                        clonedPost.style.border = '1px solid #ddd';
                        clonedPost.style.borderRadius = '6px';
                        clonedPost.style.marginTop = '6px';
                        clonedPost.style.padding = '6px';
                        clonedPost.style.background = '#fafafa';
                        wrapper.appendChild(clonedPost);
                    }

                    resultatDiv.appendChild(wrapper);
                }
            });
        } catch (err) {
            console.error(`Error scraping page ${page}:`, err);
        }

        if (searchCancelled) break;
        if (safeCheckbox && safeCheckbox.checked) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    if (progressBar) progressBar.style.width = '100%';

    if (searchCancelled) {
        if (activityText) activityText.textContent = `Sökning avbruten. Hittade ${hits.length} länkar innan stopp.`;
        return;
    }

    if (activityText) activityText.textContent = `Aktivitet: Klar! Hittade ${hits.length} länkar.`;
    console.log('All links found:', hits);
}


let fbqolFirstLoad = true;
function main(){
    if(bypassLeavingSetting){try{const u=new URLSearchParams(location.search).get('u');if(location.pathname.endsWith('/leave.php')&&u){location.replace(decodeURIComponent(u));return}}catch(e){}}
     if (showTsSetting === true || markReadThreadsSetting === true) {
        loadSaveThreadAndTS();
    } // 251013
    if (markReadThreadsSetting === true) {
        highlightStoredThreads()
    }
    if (saveDraftsSetting === true) {
        saveAndLoadDraft();
    }
    if (searchLinksSetting === true) {
        searchLinks();
    }
    getUsers(function(retrievedUsers) {
        users = retrievedUsers; 
        findPosts();
    });
    if (fbqolFirstLoad) {
        if (document.readyState === 'loading') {
            document.documentElement.style.visibility = 'hidden';
            document.addEventListener('DOMContentLoaded', function() {
                try {
                    if(bypassLeavingSetting){rewriteLeaveLinks()}
                    findPosts();
                    if (showTsSetting === true || markReadThreadsSetting === true) {
                        loadSaveThreadAndTS();
                    } // 251013
                    if (markReadThreadsSetting === true) {
                        highlightStoredThreads()
                    }
                    if (saveDraftsSetting === true) {
                        saveAndLoadDraft();
                    }
                    if (searchLinksSetting === true) {
                        searchLinks();
                    }
                } catch(error){
                    //console.log('KATTSKRÄLLE:'+error);
                }
                document.documentElement.style.visibility = '';
                if (infiniteScrollSetting===true){
                    getThreadInfo();
                    initialAddPageNumberToPostsInDom(currentPage);
                    saveFirstNavbar(currentPage);
                    addFloatingPageDiv();
                    updateFloatingDiv(currentPage);
                    fixMultiQuote();
                    setupMutationObserver();
                    if (lowestPageLoaded>1){addLoadLastPageButton()};
                    window.onscroll = function(ev) {
                        //251026 don't run when search div is open
                        const toggleDiv = document.querySelector('.kattskralle-search-div');
                        if (toggleDiv) return;
                        //251026 don't run when search div is open
                        if (scrollTimeout) clearTimeout(scrollTimeout);
                        scrollTimeout = setTimeout(() => {
                            checkPostClosestToWindowCenter();
                            tryTriggerForwardLoad(800); 
                            if (window.scrollY === 0) {
                                if (nextPageLoaded === 0 && threadId.substring(0,2) === '/t') {
                                    addLoadLastPageButton();
                                }
                                if (lowestPageLoaded > 1) {
                                    nextPageLoaded = 1;
                                }
                            } else {
                                if (!isInitiatingPageLoad) {
                                    nextPageLoaded = 0;
                                }
                            }
                        }, 150); // 150ms debounce
                    };
                }
            });
        } else {
            try {
                if(bypassLeavingSetting){rewriteLeaveLinks()}
                findPosts();
            } catch(error){
                //console.log('KATTSKRÄLLE:'+error);
            };
            document.documentElement.style.visibility = '';
            if (infiniteScrollSetting===true){
                getThreadInfo();
                initialAddPageNumberToPostsInDom(currentPage);
                saveFirstNavbar(currentPage);
                addFloatingPageDiv();
                updateFloatingDiv(currentPage);
                fixMultiQuote();
                if (lowestPageLoaded>1){addLoadLastPageButton()};
                window.onscroll = function(ev) {
                    //251026 don't run when search div is open
                    const toggleDiv = document.querySelector('.kattskralle-search-div');
                    if (toggleDiv) return;
                    //251026 don't run when search div is open
                    checkPostClosestToWindowCenter();
                    tryTriggerForwardLoad(800);
                    if (window.scrollY === 0) {
                        if (nextPageLoaded === 0 && threadId.substring(0,2) === '/t') {
                            addLoadLastPageButton();
                        }
                        if (lowestPageLoaded > 1) {
                            nextPageLoaded = 1;
                        }
                    } else {
                        if (!isInitiatingPageLoad) {
                            nextPageLoaded = 0;
                        }
                    }
                };
            }
        }
        fbqolFirstLoad = false;
    } else {
        reInitPlugin();
    }
}

function reInitPlugin() {
    findPosts();
    if (markReadThreadsSetting === true) {
        highlightStoredThreads()
    }
    if (infiniteScrollSetting===true){
        if (!document.getElementById("floatingDiv")) {
            addFloatingPageDiv();
        }
        fixMultiQuote();
        if (lowestPageLoaded>1){addLoadLastPageButton()};
        window.onscroll = function(ev) {
            //251026 don't run when search div is open
            const toggleDiv = document.querySelector('.kattskralle-search-div');
            if (toggleDiv) return;
            //251026 don't run when search div is open
            checkPostClosestToWindowCenter();
            tryTriggerForwardLoad(800);
            if (window.innerHeight + Math.round(window.scrollY) >= document.body.offsetHeight) {
            }
            if (window.scrollY === 0) {
                if (nextPageLoaded === 0 && threadId.substring(0,2) === '/t') {
                    addLoadLastPageButton();
                }
                nextPageLoaded = 1;
            }
        };
        checkPostClosestToWindowCenter();
    }
}

ensureDefaultSettings(loadSettings);

document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        reInitPlugin();
    }
});