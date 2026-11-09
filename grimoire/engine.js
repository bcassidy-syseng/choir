/*
 * Commander Grimoire player app: the stats engine.
 * Pure functions over the compact dataset. Every view in the app is
 * computed here from the same filtered list of games, so changing the
 * season or group recomputes everything instantly on the phone.
 *
 * Dataset game: { id, g (group index), t (ms), d (yyyy-mm-dd), r (rounds),
 *   wc (win condition), pod: [[player, deck, won, fun, salt, mulligans,
 *   endingLife, kills, startedFirst, turnSeconds, timedTurns], ...] }
 */
(function (root) {
  'use strict';

  var RATING_START = 1000;
  var RATING_K = 24; // matches LIVING_LEAGUE_CONFIG.RATING_K on the server

  var SEAT = { PLAYER: 0, DECK: 1, WON: 2, FUN: 3, SALT: 4, MULL: 5, LIFE: 6, KILLS: 7, FIRST: 8, TSEC: 9, TTURNS: 10 };

  function seasons(dataset) {
    var years = {};
    dataset.games.forEach(function (g) { if (g.d) years[g.d.slice(0, 4)] = true; });
    var list = [{ id: 'all', label: 'All time' }];
    Object.keys(years).sort().reverse().forEach(function (y) { list.push({ id: 'y' + y, label: y }); });
    list.push({ id: '90d', label: 'Last 90 days' });
    list.push({ id: 'last25', label: 'Last 25 battles' });
    return list;
  }

  function filterGames(dataset, filter, now) {
    var games = dataset.games;
    var group = filter && filter.group !== undefined ? String(filter.group) : 'all';
    var season = filter && filter.season || 'all';
    if (group !== 'all') games = games.filter(function (g) { return String(g.g) === group; });
    if (season === '90d') {
      var cutoff = (now || Date.now()) - 90 * 86400000;
      games = games.filter(function (g) { return g.t >= cutoff; });
    } else if (season === 'last25') {
      games = games.slice(0, 25);
    } else if (season.charAt(0) === 'y') {
      var year = season.slice(1);
      games = games.filter(function (g) { return g.d.slice(0, 4) === year; });
    }
    return games;
  }

  function avg(total, count) { return count ? total / count : null; }

  function newPlayer(index) {
    return {
      index: index, games: 0, wins: 0, results: [], funT: 0, funN: 0, saltT: 0, saltN: 0,
      tsec: 0, tturns: 0, kills: 0, killsN: 0, firsts: 0, firstWins: 0, decks: {}, lastT: 0,
      rating: RATING_START, history: []
    };
  }

  function newDeck(index) {
    return {
      index: index, games: 0, wins: 0, results: [], funT: 0, funN: 0, saltT: 0, saltN: 0,
      roundsT: 0, roundsN: 0, roundsWonT: 0, roundsWonN: 0, vs: {}, pilots: {}, lastT: 0, wincons: {}
    };
  }

  /** Everything the app shows, for one list of games (newest first). */
  function compute(dataset, games) {
    var players = {};
    var decks = {};
    var pairs = {};

    games.forEach(function (game) {
      var winner = null;
      game.pod.forEach(function (seat) { if (seat[SEAT.WON] === 1) winner = seat[SEAT.PLAYER]; });

      game.pod.forEach(function (seat) {
        var pi = seat[SEAT.PLAYER];
        var di = seat[SEAT.DECK];
        var won = seat[SEAT.WON] === 1;
        var p = players[pi] || (players[pi] = newPlayer(pi));
        var d = decks[di] || (decks[di] = newDeck(di));

        p.games++; d.games++;
        if (won) { p.wins++; d.wins++; }
        p.results.push(won ? 1 : 0); d.results.push(won ? 1 : 0);
        if (game.t > p.lastT) p.lastT = game.t;
        if (game.t > d.lastT) d.lastT = game.t;
        if (seat[SEAT.FUN] !== null) { p.funT += seat[SEAT.FUN]; p.funN++; d.funT += seat[SEAT.FUN]; d.funN++; }
        if (seat[SEAT.SALT] !== null) { p.saltT += seat[SEAT.SALT]; p.saltN++; d.saltT += seat[SEAT.SALT]; d.saltN++; }
        if (seat[SEAT.TTURNS] > 0 && seat[SEAT.TSEC] !== null) { p.tsec += seat[SEAT.TSEC]; p.tturns += seat[SEAT.TTURNS]; }
        if (seat[SEAT.KILLS] !== null) { p.kills += seat[SEAT.KILLS]; p.killsN++; }
        if (seat[SEAT.FIRST] === 1) { p.firsts++; if (won) p.firstWins++; }
        if (game.r !== null) {
          d.roundsT += game.r; d.roundsN++;
          if (won) { d.roundsWonT += game.r; d.roundsWonN++; }
        }
        if (won && game.wc) d.wincons[game.wc] = (d.wincons[game.wc] || 0) + 1;

        var pd = p.decks[di] || (p.decks[di] = { deck: di, games: 0, wins: 0 });
        pd.games++; if (won) pd.wins++;
        d.pilots[pi] = (d.pilots[pi] || 0) + 1;

        game.pod.forEach(function (other) {
          if (other === seat) return;
          var opp = other[SEAT.PLAYER];
          var vs = d.vs[opp] || (d.vs[opp] = { player: opp, games: 0, wins: 0 });
          vs.games++; if (won) vs.wins++;
        });
      });

      for (var a = 0; a < game.pod.length; a++) {
        for (var b = a + 1; b < game.pod.length; b++) {
          var pa = game.pod[a][SEAT.PLAYER];
          var pb = game.pod[b][SEAT.PLAYER];
          var lo = Math.min(pa, pb);
          var hi = Math.max(pa, pb);
          var key = lo + '|' + hi;
          var pair = pairs[key] || (pairs[key] = { a: lo, b: hi, games: 0, aWins: 0, bWins: 0, lastT: 0 });
          pair.games++;
          if (winner === lo) pair.aWins++;
          if (winner === hi) pair.bWins++;
          if (game.t > pair.lastT) pair.lastT = game.t;
        }
      }
    });

    rate(games, players);

    var standings = Object.keys(players).map(function (k) {
      var p = players[k];
      p.losses = p.games - p.wins;
      p.winRate = p.games ? p.wins / p.games : 0;
      p.fun = avg(p.funT, p.funN);
      p.salt = avg(p.saltT, p.saltN);
      p.turnSeconds = p.tturns ? p.tsec / p.tturns : null;
      p.streak = streak(p.results);
      p.signature = signatureDeck(p, dataset);
      return p;
    }).sort(byWins(dataset));
    standings.forEach(function (p, i) { p.rank = i + 1; });

    var deckList = Object.keys(decks).map(function (k) {
      var d = decks[k];
      d.losses = d.games - d.wins;
      d.winRate = d.games ? d.wins / d.games : 0;
      d.fun = avg(d.funT, d.funN);
      d.salt = avg(d.saltT, d.saltN);
      d.rounds = avg(d.roundsT, d.roundsN);
      d.roundsToWin = avg(d.roundsWonT, d.roundsWonN);
      d.streak = streak(d.results);
      return d;
    }).sort(function (x, y) {
      return y.wins - x.wins || y.winRate - x.winRate || y.games - x.games ||
        String(dataset.decks[x.index].n).localeCompare(String(dataset.decks[y.index].n));
    });

    return { games: games, players: players, standings: standings, decks: decks, deckList: deckList, pairs: pairs };
  }

  /** Multiplayer Elo, identical to calculateLivingLeagueRatings_ on the server. */
  function rate(games, players) {
    var ordered = games.slice().sort(function (x, y) {
      return x.t - y.t || x.g - y.g || String(x.id).localeCompare(String(y.id));
    });
    ordered.forEach(function (game) {
      var seats = game.pod;
      if (seats.length < 2) return;
      var winner = null;
      seats.forEach(function (s) { if (s[SEAT.WON] === 1) winner = s[SEAT.PLAYER]; });
      var before = {};
      var change = {};
      seats.forEach(function (s) { before[s[SEAT.PLAYER]] = players[s[SEAT.PLAYER]].rating; change[s[SEAT.PLAYER]] = 0; });
      var pairK = RATING_K / (seats.length - 1);
      for (var i = 0; i < seats.length; i++) {
        for (var j = i + 1; j < seats.length; j++) {
          var a = seats[i][SEAT.PLAYER];
          var b = seats[j][SEAT.PLAYER];
          var expected = 1 / (1 + Math.pow(10, (before[b] - before[a]) / 400));
          var score = a === winner ? 1 : b === winner ? 0 : 0.5;
          var delta = pairK * (score - expected);
          change[a] += delta;
          change[b] -= delta;
        }
      }
      seats.forEach(function (s) {
        var p = players[s[SEAT.PLAYER]];
        p.rating = before[s[SEAT.PLAYER]] + change[s[SEAT.PLAYER]];
        p.history.push({ t: game.t, r: p.rating, id: game.id });
      });
    });
    Object.keys(players).forEach(function (k) { players[k].ratingRounded = Math.round(players[k].rating); });
  }

  function byWins(dataset) {
    return function (x, y) {
      return y.wins - x.wins || y.winRate - x.winRate || y.games - x.games ||
        String(dataset.players[x.index].n).localeCompare(String(dataset.players[y.index].n));
    };
  }

  /** Current run of identical results, newest first. */
  function streak(results) {
    if (!results.length) return { kind: '', length: 0 };
    var kind = results[0];
    var n = 0;
    while (n < results.length && results[n] === kind) n++;
    return { kind: kind ? 'W' : 'L', length: n };
  }

  function signatureDeck(player, dataset) {
    var best = null;
    Object.keys(player.decks).forEach(function (k) {
      var d = player.decks[k];
      if (!best || d.games > best.games || (d.games === best.games && d.wins > best.wins)) best = d;
    });
    return best ? best.deck : null;
  }

  /** Head-to-head records for one player against everyone they have met. */
  function rivals(stats, playerIndex) {
    var list = [];
    Object.keys(stats.pairs).forEach(function (k) {
      var pair = stats.pairs[k];
      if (pair.a !== playerIndex && pair.b !== playerIndex) return;
      var mine = pair.a === playerIndex;
      list.push({
        player: mine ? pair.b : pair.a,
        games: pair.games,
        myWins: mine ? pair.aWins : pair.bWins,
        theirWins: mine ? pair.bWins : pair.aWins,
        lastT: pair.lastT
      });
    });
    return list.sort(function (x, y) { return y.games - x.games || y.theirWins - x.theirWins; });
  }

  /** Short, useful observations for the home screen. */
  function insights(dataset, stats, playerIndex) {
    var p = stats.players[playerIndex];
    if (!p) return [];
    var out = [];
    var rivalList = rivals(stats, playerIndex);
    var nemesis = rivalList.filter(function (r) { return r.theirWins >= 2 && r.theirWins > r.myWins; })
      .sort(function (x, y) { return (y.theirWins - y.myWins) - (x.theirWins - x.myWins) || y.theirWins - x.theirWins; })[0];
    if (nemesis) out.push({ kind: 'nemesis', player: nemesis.player, value: nemesis.theirWins, games: nemesis.games });
    var prey = rivalList.filter(function (r) { return r.myWins >= 2 && r.myWins > r.theirWins; })
      .sort(function (x, y) { return (y.myWins - y.theirWins) - (x.myWins - x.theirWins); })[0];
    if (prey) out.push({ kind: 'prey', player: prey.player, value: prey.myWins, games: prey.games });
    var bestDeck = Object.keys(p.decks).map(function (k) { return p.decks[k]; })
      .filter(function (d) { return d.games >= 3; })
      .sort(function (x, y) { return y.wins / y.games - x.wins / x.games || y.games - x.games; })[0];
    if (bestDeck && Object.keys(p.decks).length > 1) out.push({ kind: 'bestDeck', deck: bestDeck.deck, value: bestDeck.wins / bestDeck.games, games: bestDeck.games });
    if (p.streak.length >= 2) out.push({ kind: 'streak', value: p.streak.length, streakKind: p.streak.kind });
    if (p.firsts >= 3) out.push({ kind: 'first', value: p.firstWins / p.firsts, games: p.firsts });
    return out;
  }

  var api = {
    SEAT: SEAT, RATING_START: RATING_START, seasons: seasons, filterGames: filterGames,
    compute: compute, rivals: rivals, insights: insights, streak: streak
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(this);
