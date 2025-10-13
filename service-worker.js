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

// ---------------------------------------------------------------
// --- Queue & Rate-Limiting System for fetchSite requests -------
// ---------------------------------------------------------------

const requestQueue = [];
let activeRequests = 0;
const MAX_REQUESTS = 10;
const TIME_WINDOW = 30 * 1000; // 30 seconds
let firstRequestTime = null;

// --- Main message listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "fetchSite") {
        enqueueRequest({ url: request.url, sender, sendResponse });
        return true; // async response
    }

    if (request.action === "fetchThreadTS") {
        handleFetchThreadTS({ threadId: request.threadId, sendResponse });
        return true; // async response
    }

    // Unknown message → ignore
    return false;
});

// ---------------------------------------------------------------
// --- fetchSite queue handling ----------------------------------
// ---------------------------------------------------------------

function enqueueRequest(requestData) {
    requestQueue.push(requestData);
    processQueue();
}

function processQueue() {
    if (requestQueue.length === 0) return;

    const now = Date.now();

    if (!firstRequestTime || now - firstRequestTime >= TIME_WINDOW) {
        firstRequestTime = now;
        activeRequests = 0;
    }

    while (activeRequests < MAX_REQUESTS && requestQueue.length > 0) {
        const requestData = requestQueue.shift();
        activeRequests++;
        handleRequest(requestData);
    }

    if (requestQueue.length > 0) {
        const nextTime = firstRequestTime + TIME_WINDOW - now;
        setTimeout(processQueue, nextTime > 0 ? nextTime : 0);
    }
}

// ---------------------------------------------------------------
// --- Handle "fetchSite" request (original logic) ---------------
// ---------------------------------------------------------------

function handleRequest({ url, sender, sendResponse }) {
    let responded = false;
    const safeSendResponse = (data) => {
        if (!responded) {
            responded = true;
            sendResponse(data);
        }
    };

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {
            const decoder = new TextDecoder('iso-8859-1');
            const html = decoder.decode(arrayBuffer);

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs || tabs.length === 0 || !tabs[0].id) {
                    safeSendResponse({ response: "No active tab found." });
                    return;
                }

                const tabId = tabs[0].id;

                // Try sending message to content script
                chrome.tabs.sendMessage(tabId, { message: "parseHTML", html }, (response) => {
                    if (chrome.runtime.lastError) {
                        // If sendMessage failed, inject content script dynamically
                        chrome.scripting.executeScript({
                            target: { tabId },
                            files: ['contentScript.js']
                        }, () => {
                            chrome.tabs.sendMessage(tabId, { message: "parseHTML", html }, (resp) => {
                                if (chrome.runtime.lastError) {
                                    safeSendResponse({ response: "Error: " + chrome.runtime.lastError.message });
                                } else {
                                    safeSendResponse(resp);
                                }
                            });
                        });
                    } else {
                        safeSendResponse(response);
                    }
                });
            });
        })
        .catch(error => {
            safeSendResponse({ response: "Could not fetch page: " + error.message });
        });
}

// ---------------------------------------------------------------
// --- Handle "fetchThreadTS" request -----------------------------
// ---------------------------------------------------------------

function handleFetchThreadTS({ threadId, sendResponse }) {
    if (!threadId) {
        sendResponse({ error: "No threadId provided." });
        return;
    }

    const url = `https://www.flashback.org/${threadId}`;
    console.log("Fetching thread for TS:", url);

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {
            const decoder = new TextDecoder('iso-8859-1');
            const html = decoder.decode(arrayBuffer);

            // ✅ Just return the HTML to the content script
            sendResponse({ threadId, html });
        })
        .catch(error => {
            console.error("Error fetching thread TS:", error);
            sendResponse({ error: error.message });
        });
}