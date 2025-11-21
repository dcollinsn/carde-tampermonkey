// ==UserScript==
// @name         Carde Helper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Extract Event ID and Auth Token from Carde dashboard
// @author       You
// @match        https://dashboard.carde.io/events/*
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    function getEventId() {
        // Extract UUID from URL like https://dashboard.carde.io/events/9fed381f-e123-420d-af10-1516876a8b04
        const urlParts = window.location.pathname.split('/');
        const eventId = urlParts[urlParts.length - 1];

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(eventId)) {
            return eventId;
        }
        return null;
    }

    function getAuthToken() {
        try {
            // Look for Auth0 SPA key pattern
            const auth0Keys = Object.keys(localStorage).filter(key =>
                key.startsWith('@@auth0spajs@@') && key.includes('@@user@@')
            );

            if (auth0Keys.length === 0) {
                console.log('No Auth0 user keys found');
                return null;
            }

            // Use the first matching key
            const authKey = auth0Keys[0];
            const authData = JSON.parse(localStorage.getItem(authKey));

            if (authData && authData.id_token) {
                return authData.id_token;
            }

            console.log('No id_token found in auth data');
            return null;
        } catch (error) {
            console.error('Error extracting auth token:', error);
            return null;
        }
    }

    function copyToClipboard(text, label) {
        if (text) {
            GM_setClipboard(text);
            console.log(`${label} copied to clipboard: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
        } else {
            console.log(`Could not find ${label}`);
            showNotification(`Could not find ${label}`, 'error');
        }
    }

    function showNotification(message, type = 'success') {
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#f8d7da' : '#d4edda'};
            color: ${type === 'error' ? '#721c24' : '#155724'};
            border: 1px solid ${type === 'error' ? '#f5c6cb' : '#c3e6cb'};
            border-radius: 4px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            transition: opacity 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    function copyEventId() {
        const eventId = getEventId();
        copyToClipboard(eventId, 'Event ID');
    }

    function copyToken() {
        const token = getAuthToken();
        copyToClipboard(token, 'Auth Token');
    }

    // Debounce flag to prevent double execution
    let isOpening = false;

    function openTournamentTools() {
        // Prevent double execution
        if (isOpening) {
            console.log('Tournament tools already opening, ignoring duplicate call');
            return;
        }

        isOpening = true;
        console.log('Opening tournament tools...');

        const eventId = getEventId();
        const token = getAuthToken();

        if (!eventId) {
            console.log('Could not find Event ID from current page URL');
            showNotification('Could not find Event ID from current page URL', 'error');
            isOpening = false;
            return;
        }

        if (!token) {
            console.log('Could not find Auth Token. Please make sure you are logged in.');
            showNotification('Could not find Auth Token. Please make sure you are logged in.', 'error');
            isOpening = false;
            return;
        }

        const LAMBDA_URL = 'https://carde.dcollins.cc/';

        // Use GET request with query parameters instead of POST form
        const params = new URLSearchParams({
            'eventId': eventId,
            'token': token,
            'tool': 'pairings_by_name',
            'round': '1'
        });

        const url = `${LAMBDA_URL}?${params.toString()}`;
        console.log('Opening URL:', url.replace(/token=[^&]*/, 'token=***'));

        // Open in new tab
        const newWindow = window.open(url, '_blank');

        if (!newWindow) {
            showNotification('Popup blocked. Please allow popups for this site.', 'error');
            console.log('Popup was blocked');
        } else {
            console.log('Window opened successfully');
        }

        // Reset flag after 1 second
        setTimeout(() => {
            isOpening = false;
            console.log('Reset isOpening flag');
        }, 1000);
    }

    // Register menu commands
    GM_registerMenuCommand('🚀 Open Tournament Tools', openTournamentTools);
    GM_registerMenuCommand('Copy Event ID', copyEventId);
    GM_registerMenuCommand('Copy Token', copyToken);

    // Optional: Add console logging for debugging
    console.log('Carde Helper loaded');
    console.log('Event ID:', getEventId());
    console.log('Auth keys available:', Object.keys(localStorage).filter(key => key.includes('auth0')));
})();
