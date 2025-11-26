// ==UserScript==
// @name         Cardev2 Purplefox Extract
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Extract information about the current Carde.io v2 round, and format it for PurpleFox.
// @author       Dan Collins <dcollins@batwing.tech>
// @author       Aurélie Violette
// @website      https://github.com/dcollinsn/carde-tampermonkey
// @updateURL    https://raw.githubusercontent.com/dcollinsn/carde-tampermonkey/main/cardev2-to-purplefox.user.js
// @downloadURL  https://raw.githubusercontent.com/dcollinsn/carde-tampermonkey/main/cardev2-to-purplefox.user.js
// @match        https://admin.carde.io/admin/events/*/pairings/round/*
// @match        https://admin.carde.io/admin/events/*/standings/round/*
// @icon         https://admin.carde.io/favicon.ico
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant       GM_cookie
// ==/UserScript==

function getSessionToken() {
  return new Promise((resolve, reject) => {
    GM_cookie.list({ name: "web_sessionToken" }, (cookies, error) => {
      if (error) {
        console.error("Error reading web_sessionToken:", error);
        reject(error);
        return;
      }
      if (!cookies || cookies.length === 0) {
        reject(new Error("web_sessionToken cookie not found"));
        return;
      }
      resolve(cookies[0].value);
    });
  });
}

async function extractResultCarde() {
  const [, eventId, roundId] =
    window.location.pathname.match(/\/events\/(\d+)\/(?:pairings|standings)\/round\/(\d+)/) ||
    [];
  const token = await getSessionToken();
  const url = `https://api.admin.carde.io/api/v2/organize/tournament-rounds/${roundId}/matches-list/?round_id=${roundId}&avoid_cache=true&page=1&page_size=3000`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Token ${token}`,
    },
    credentials: "include",
  });
  if (!response.ok) {
    return {
      value: [],
      message: `Error fetching data: ${response.statusText}`,
      errorCount: 1,
    };
  }
  const { results: matches } = await response.json();

  const result = matches
    .map((match) => {
      if (match.table_number < 0) return;
      const player1 = match?.player_match_relationships?.[0];
      const player2 = match?.player_match_relationships?.[1];
      let matchResult;
      if (match.status === "COMPLETE") {
        matchResult =
          match.winning_player_id === player1?.player?.id
            ? "1WIN"
            : match.winning_player_id === player2?.player?.id
            ? "2WIN"
            : "DRAW";
      }
      return {
        tableNumber: match.table_number,
        playerName1: player1?.player
          ? `${player1.player.last_name}, ${player1.player.first_name}`
          : null,
        playerGameId1: player1?.player?.id || null,
        playerName2: player2?.player
          ? `${player2.player.last_name}, ${player2.player.first_name}`
          : null,
        playerGameId2: player2?.player?.id || null,
        result: matchResult,
      };
    })
    .filter((m) => m !== undefined);

  let errorCount = 0;
  let message = "Copied to clipboard";
  if (errorCount > 0) {
    message = `${errorCount} errors found. Copied to clipboard`;
  }
  return result;
}

async function extractStandingsCarde() {
  const [, eventId, roundId] =
    window.location.pathname.match(
      /\/events\/(\d+)\/(?:pairings|standings)\/round\/(\d+)/
    ) || [];
  const url = `https://api.admin.carde.io/api/v2/organize/tournament-rounds/${roundId}/standings?avoid_cache=true&page=1&page_size=3000`;
  let token;
  const cookies = `; ${document.cookie}`;
  const parts = cookies.split(`; web_sessionToken=`);
  if (parts.length === 2) token = parts.pop().split(";").shift();
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Token ${token}`,
    },
    credentials: "include",
  });
  if (!response.ok) {
    return {
      value: [],
      message: `Error fetching data: ${response.statusText}`,
      errorCount: 1,
    };
  }
  const { results: players } = await response.json();

  const result = players.map((line) => {
    return {
      name: line.user_event_status?.user?.last_first,
      gameId: line.player?.id,
      standing: line.points,
      isDropped: line.user_event_status?.registration_status === "DROPPED",
      rank: line?.rank,
    };
  });

  let errorCount = 0;
  let message = "Copied to clipboard";
  if (errorCount > 0) {
    message = `${errorCount} errors found. Copied to clipboard`;
  }
  return result;
}

async function doMenuCommandResults(event) {
    const result = await extractResultCarde();
    GM_setClipboard(JSON.stringify(result));
}

async function doMenuCommandStandings(event) {
    const result = await extractStandingsCarde();
    GM_setClipboard(JSON.stringify(result));
}

(function() {
    'use strict';
    const menu_command_id = GM_registerMenuCommand("PurpleFox Export Results", doMenuCommandResults, "e");
    const menu_command_id2 = GM_registerMenuCommand("PurpleFox Export Standings", doMenuCommandStandings, "r");
})();
