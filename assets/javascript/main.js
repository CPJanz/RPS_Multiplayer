// Global Variables
let playerId;
let opponentId;
let gameId;
let round = 1;
let playerWins = 0;
let opponentWins = 0;

// Initialize Firebase
let config = {
    apiKey: "AIzaSyDLRVZN-p3oAz83cUiSTGOieBOUQb__C5g",
    authDomain: "rock-paper-scissors-8d1fb.firebaseapp.com",
    databaseURL: "https://rock-paper-scissors-8d1fb.firebaseio.com",
    projectId: "rock-paper-scissors-8d1fb",
    storageBucket: "rock-paper-scissors-8d1fb.appspot.com",
    messagingSenderId: "471972604018"
};
firebase.initializeApp(config);
let database = firebase.database();


// Determines the outcome of an indivitual throw. Posts the results to the chat.
function calculateOutcome(player, opponent) {
    $("#chat").empty();
    chatPost("ROUND " + round);
    chatPost("You threw " + player);
    chatPost("Your opponent threw " + opponent);
    if (player === opponent) {
        chatPost("It's a tie!");
    } else if ((player === "paper" && opponent === "rock") ||
        (player === "rock" && opponent === "scissors") ||
        (player === "scissors" && opponent === "paper")) {
        chatPost("You win!");
        playerWins++;
    } else {
        chatPost("you lose!");
        opponentWins++;
    }
    $("#player-wins").text(playerWins);
    $("#opponent-wins").text(opponentWins);
}

// Displays the passed message to the chat.
function chatPost(message) {
    $("#chat").append($("<li>" + message + "</li>"));
}

// Event handlers
$(document).ready(function() {
    // Get playerCount, add one, set that as your playerId and then send the new playerCount back up to firebase.
    database.ref("/playerCount").once("value", function(snapshot) {
        playerId = snapshot.val() + 1;
        database.ref("/playerCount").set(playerId);
    })

    // Check for game waiting to start, if one is found join it. If not, create one
    database.ref("/waitingGames").once("value", function(snapshot) {
        let waitingGame = snapshot.val();
        if (!waitingGame) { // If there's no waiting game 
            database.ref("/gameCount").once("value", function(snapshot) {
                let gameCount = snapshot.val() + 1;
                gameId = "game" + gameCount; //Set gameId for tracking later
                chatPost("Waiting for Opponent...");
                database.ref("/gameCount").set(gameCount)
                database.ref("/waitingGames/" + gameId + "/player1").set(playerId) // Create a waiting game

                //Once a second player has been found and the local player is in a runningGame, this code block will trigger
                database.ref("runningGames/" + gameId + "/rounds").on("value", function(snapshot) {
                    if (snapshot.val()) {
                        let roundResults = snapshot.val()[round];
                        opponentId = playerId + 1; // Opponent will be the next player joining
                        // Display game ready to start message and set controls to visible
                        if (round === 1) {
                            $("#chat").empty()
                            chatPost("Opponent Found. Select Rock Paper or Scissors to start playing.")
                        }
                        $(".game-controls").css("visibility", "visible");
                        // If both players have chosen, process the result and move on to next round.
                        if (roundResults[playerId] !== 0 && roundResults[opponentId] !== 0) {
                            calculateOutcome(roundResults[playerId], roundResults[opponentId]);
                            round++;
                        }
                    }
                });
                // Displays chat messages to the chat
                database.ref("runningGames/" + gameId + "/chat").on("child_added", function(snapshot) {
                    if (snapshot.val().player === playerId) {
                        chatPost("You: " + snapshot.val().message);
                    } else {
                        chatPost("Opponent: " + snapshot.val().message);
                    }
                })
            });

        } else {
            // Game already exists, join it as second player then "move" it to the runningGames
            // The second player communicates with the server to advance the game.
            gameId = Object.keys(waitingGame).toString();

            // Display game ready to start message and set controls to visible
            $(".game-controls").css("visibility", "visible");
            chatPost("Opponent Found. Select Rock Paper or Scissors to start playing.");

            // Adds local player to the waitingGame object, then creates a runningGame and removes the waitingGame.
            // Finally it starts the first round.
            waitingGame[gameId].player2 = playerId;
            opponentId = waitingGame[gameId].player1;
            database.ref("/waitingGames/" + gameId).remove();
            database.ref("/runningGames/" + gameId).set({
                player1: waitingGame[gameId].player1,
                player2: waitingGame[gameId].player2,
                rounds: {
                    1: {
                        [waitingGame[gameId].player1]: 0,
                        [waitingGame[gameId].player2]: 0
                    }
                }
            });

            // Processes rounds of the game 
            database.ref("runningGames/" + gameId + "/rounds").on("value", function(snapshot) {
                let roundResults = snapshot.val()[round];
                if (roundResults[playerId] !== 0 && roundResults[opponentId] !== 0) {
                    calculateOutcome(roundResults[playerId], roundResults[opponentId]);
                    round++;
                    database.ref("runningGames/" + gameId + "/rounds/" + round).set({
                        [opponentId]: 0,
                        [playerId]: 0
                    })
                }
            })

            // Displays chat messages in chat.
            database.ref("runningGames/" + gameId + "/chat").on("child_added", function(snapshot) {
                if (snapshot.val().player === playerId) {
                    chatPost("You: " + snapshot.val().message);
                } else {
                    chatPost("Opponent: " + snapshot.val().message);
                }
            })
        }
    })
})

// On click event for rock, paper, scissors buttons
$(document).on("click", ".throw-button", function() {
    database.ref("runningGames/" + gameId + "/rounds/" + round + "/" + playerId).set($(this).attr("choice"));
})

// On click event for chat button
$(document).on("click", "#chat-button", function() {
    database.ref("runningGames/" + gameId + "/chat").push({ player: playerId, message: ($("#chat-text").val()) });
    $("#chat-text").val("");
})