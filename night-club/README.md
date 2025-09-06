# Berghain Challenge

You're the bouncer at a night club. Your goal is to fill the venue with N=1000 people while satisfying constraints like "at least 40% Berlin locals", or "at least 80% wearing all black". People arrive one by one, and you must immediately decide whether to let them in or turn them away. Your challenge is to fill the venue with as few rejections as possible while meeting all minimum requirements.

## How it works

- People arrive sequentially with binary attributes (e.g., female/male, young/old, regular/new)
- You must make immediate accept/reject decisions
- The game ends when either:
  (a) venue is full (1000 people)
  (b) you rejected 20,000 people

## Scenarios & Scoring

There are 3 different scenarios. For each, you are given a list of constraints and statistics on the attribute distribution. You can assume, participants are sampled i.i.d., meaning the attribute distribution will not change as the night goes on. You know the overall relative frequency of each attribute and the correlation between attributes. You don't know the exact distribution.
You score is the number of people you rejected before filling the venue (the less the better).

## Prize 🎉

The person at the top of the leaderboard Sept 15 6am PT will be the winner and get to go to Berghain - we fly you out! Also you get to interview with Listen ;)

## API

1. Create a new game:
   /new-game?scenario=1&playerId=4c92c8d7-7dc1-467d-a6e0-c19276646758
   Choose scenario 1, 2, or 3.
   playerId identifies you as the player.

Returns:
{
"gameId": UUID,
"constraints": {
"attribute": AttributeId,
"minCount": number
}[],
"attributeStatistics": {
"relativeFrequencies": {
[attributeId]: number // 0.0-1.0
},
"correlations": {
[attributeId1]: {
[attributeId2]: number // -1.0-1.0
}
}
}
}

2. Get person and make decision:
   /decide-and-next?gameId=uuid&personIndex=0&accept=true
   Get the next person in the queue. For the first person (personIndex=0), the accept parameter is optional. For subsequent persons, include accept=true or accept=false to make a decision.

Returns:
{
"status": "running",
"admittedCount": number,
"rejectedCount": number,
"nextPerson": {
"personIndex": number,
"attributes": { [attributeId]: boolean }
}
} | {
"status": "completed",
"rejectedCount": number,
"nextPerson": null
} | {
"status": "failed",
"reason": string,
"nextPerson": null
}

## Scenario 1

```json
{
  "gameId": "<variable>",
  "constraints": [
    {
      "attribute": "young",
      "minCount": 600
    },
    {
      "attribute": "well_dressed",
      "minCount": 600
    }
  ],
  "attributeStatistics": {
    "relativeFrequencies": {
      "well_dressed": 0.3225,
      "young": 0.3225
    },
    "correlations": {
      "well_dressed": {
        "well_dressed": 1,
        "young": 0.18304299322062992
      },
      "young": {
        "well_dressed": 0.18304299322062992,
        "young": 1
      }
    }
  }
}
```

## Scenario 2

Response from `https://berghain.challenges.listenlabs.ai/new-game?scenario=2&playerId=4c92c8d7-7dc1-467d-a6e0-c19276646758`

```json
{
  "gameId": "<variable>",
  "constraints": [
    {
      "attribute": "techno_lover",
      "minCount": 650
    },
    {
      "attribute": "well_connected",
      "minCount": 450
    },
    {
      "attribute": "creative",
      "minCount": 300
    },
    {
      "attribute": "berlin_local",
      "minCount": 750
    }
  ],
  "attributeStatistics": {
    "relativeFrequencies": {
      "techno_lover": 0.6265000000000001,
      "well_connected": 0.4700000000000001,
      "creative": 0.06227,
      "berlin_local": 0.398
    },
    "correlations": {
      "techno_lover": {
        "techno_lover": 1,
        "well_connected": -0.4696169332674324,
        "creative": 0.09463317039891586,
        "berlin_local": -0.6549403815606182
      },
      "well_connected": {
        "techno_lover": -0.4696169332674324,
        "well_connected": 1,
        "creative": 0.14197259140471485,
        "berlin_local": 0.5724067808436452
      },
      "creative": {
        "techno_lover": 0.09463317039891586,
        "well_connected": 0.14197259140471485,
        "creative": 1,
        "berlin_local": 0.14446459505650772
      },
      "berlin_local": {
        "techno_lover": -0.6549403815606182,
        "well_connected": 0.5724067808436452,
        "creative": 0.14446459505650772,
        "berlin_local": 1
      }
    }
  }
}
```

## Scenario 3

```json

Response from `https://berghain.challenges.listenlabs.ai/new-game?scenario=3&playerId=4c92c8d7-7dc1-467d-a6e0-c19276646758`
{
  "gameId": "<variable>",
  "constraints": [
    {
      "attribute": "underground_veteran",
      "minCount": 500
    },
    {
      "attribute": "international",
      "minCount": 650
    },
    {
      "attribute": "fashion_forward",
      "minCount": 550
    },
    {
      "attribute": "queer_friendly",
      "minCount": 250
    },
    {
      "attribute": "vinyl_collector",
      "minCount": 200
    },
    {
      "attribute": "german_speaker",
      "minCount": 800
    }
  ],
  "attributeStatistics": {
    "relativeFrequencies": {
      "underground_veteran": 0.6794999999999999,
      "international": 0.5735,
      "fashion_forward": 0.6910000000000002,
      "queer_friendly": 0.04614,
      "vinyl_collector": 0.044539999999999996,
      "german_speaker": 0.4565000000000001
    },
    "correlations": {
      "underground_veteran": {
        "underground_veteran": 1,
        "international": -0.08110175777152992,
        "fashion_forward": -0.1696563475505309,
        "queer_friendly": 0.03719928376753885,
        "vinyl_collector": 0.07223521156389842,
        "german_speaker": 0.11188766703422799
      },
      "international": {
        "underground_veteran": -0.08110175777152992,
        "international": 1,
        "fashion_forward": 0.375711059360155,
        "queer_friendly": 0.0036693314388711686,
        "vinyl_collector": -0.03083247098181075,
        "german_speaker": -0.7172529382519395
      },
      "fashion_forward": {
        "underground_veteran": -0.1696563475505309,
        "international": 0.375711059360155,
        "fashion_forward": 1,
        "queer_friendly": -0.0034530926793377476,
        "vinyl_collector": -0.11024719606358546,
        "german_speaker": -0.3521024461597403
      },
      "queer_friendly": {
        "underground_veteran": 0.03719928376753885,
        "international": 0.0036693314388711686,
        "fashion_forward": -0.0034530926793377476,
        "queer_friendly": 1,
        "vinyl_collector": 0.47990640803167306,
        "german_speaker": 0.04797381132680503
      },
      "vinyl_collector": {
        "underground_veteran": 0.07223521156389842,
        "international": -0.03083247098181075,
        "fashion_forward": -0.11024719606358546,
        "queer_friendly": 0.47990640803167306,
        "vinyl_collector": 1,
        "german_speaker": 0.09984452286269897
      },
      "german_speaker": {
        "underground_veteran": 0.11188766703422799,
        "international": -0.7172529382519395,
        "fashion_forward": -0.3521024461597403,
        "queer_friendly": 0.04797381132680503,
        "vinyl_collector": 0.09984452286269897,
        "german_speaker": 1
      }
    }
  }
}
```
