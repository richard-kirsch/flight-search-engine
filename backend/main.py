from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import httpx
import os
import asyncio
from datetime import datetime
from typing import List, Dict, Any
from data.FlightSearchQuery import FlightSearchQuery
from data.FlightSearchResult import FlightSearchResult, FlightSegment
###MOCK QUERY
# {
#   "origins": ["BOS", "JFK"],
#   "destinations": ["CGN", "LHR"],
#   "departure_dates": ["2026-01-19", "2026-01-20", "2026-01-21"]
# } 

app = FastAPI(title="Flight Search Engine")
token = None 
base = "https://test.api.amadeus.com"  # or https://api.amadeus.com for prod
client_id = os.environ["AMADEUS_CLIENT_ID"]
client_secret = os.environ["AMADEUS_CLIENT_SECRET"]
token_lock = asyncio.Lock() # this stops multiple versions calling the new create function

async def get_token(client: httpx.AsyncClient) -> str:
    r = await client.post(
        f"{base}/v1/security/oauth2/token",
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20,
    )
    return r.json()["access_token"]
async def ensure_token(client: httpx.AsyncClient) -> str:
    global token
    if token is not None:
        return token
    async with token_lock: # stops extra token calls
        if token is None: #check after lock leaves
            token = await get_token(client)
    return token

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: replace with actual frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/status")
async def get_status():
    """Validates the backend is running."""
    return {
        "status": "online",
        "service": "flight-search-backend",
        "version": "2.0.0"
    }

@app.post("/search")
async def search_flights(query: FlightSearchQuery):
    """
    Search for flights.
    """
    try:
        async with httpx.AsyncClient() as client:
            # TODO: Call flight API here
            # response = await client.get("https://api.example.com/flights", params=query.model_dump())
            # data = response.json()
            #---------CHECKS WE HAVE TOKEN 
            # instead of token check here we will use ensure_token
            global token 
            
            token = await ensure_token(client) 
           #response = await client.get(f"{base}/v2/shopping/flight-offers", params=query.model_dump(), headers={"Authorization": f"Bearer {token}"}) 
            #---------Now we have token
            #TODO: Parse json response
            # Parsing json response: 
            flights = []
            for origin, dest, dt in parse_query(query): 
                
                params = {
                    "originLocationCode": origin,
                     "destinationLocationCode": dest,
                     "departureDate": dt.isoformat(),
                     "adults": 1,
                     "currencyCode": "USD",
                     "max": 50,
             }
                
                r = await client.get(
                     f"{base}/v2/shopping/flight-offers",
                    params=params,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30,
                )
                data = r.json()
                flights.extend(data.get("data", []))
        ### return {"flights": flights}
        results = to_results(flights)
        return [x.model_dump() for x in results]
                
                    
                
            #TODO: make sure it parses all date ranges and such
        # Mock Data
        # return {
        #     "status": "success",
        #     "search_criteria": query,
        #     "results": [
        #         {"id": 1, "airline": "FastAPI Air", "price": 450},
        #         {"id": 2, "airline": "Async Airways", "price": 520}
        #     ]
        # }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



#TODO: Parse_query - turn it into jobs to send
def parse_query(q: FlightSearchQuery):
    # yields (origin, destination, date)
    for o in q.origins:
        for d in q.destinations:
            for dt in q.departure_dates:
                yield (o.upper().strip(), d.upper().strip(), dt)
   
   
def _dt(s: str) -> datetime: # datetime helper 
    # handles "...Z" if it appears
    return datetime.fromisoformat(s.replace("Z", "+00:00"))
             
#TODO: format_results - turn that into json to send back to frontend 
def to_results(amadeus_offers: List[Dict[str, Any]]) -> List[FlightSearchResult]:
    out: List[FlightSearchResult] = []

    for offer in amadeus_offers:
        itin = offer["itineraries"][0]
        segs = itin["segments"]

        segments = [
            FlightSegment(
                origin=s["departure"]["iataCode"],
                destination=s["arrival"]["iataCode"],
                start_time=_dt(s["departure"]["at"]),
                end_time=_dt(s["arrival"]["at"]),
            )
            for s in segs
        ]

        airline = (offer.get("validatingAirlineCodes") or [segs[0].get("carrierCode", "")])[0]
        start_date = _dt(segs[0]["departure"]["at"]).date()
        price = float(offer["price"]["total"])

        out.append(
            FlightSearchResult(
                airline=airline,
                date=start_date,
                price=price,
                segments=segments,
            )
        )

    out.sort(key=lambda r: r.price)
    return out[:6]



#example json returned from backend
# {
#   "flights": [
#     {
#       "airline": "LH",
#       "date": "2026-01-19",
#       "origin": "BOS",
#       "destination": "CGN",
#       "duration": "8h 55m",
#       "start_time": "2026-01-19T17:20:00",
#       "end_time": "2026-01-20T07:15:00",
#       "layovers": ["FRA 2h 10m"],
#       "price": { "amount": 612.34, "currency": "USD" }
#     }
#   ]
# }







# --- 5. Run the server ---
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
    
    
    
    
    
    
    
    
    
    ## DATA RETURNED FROM BACKEND
#    [
#   {
#     "airline": "TK",
#     "date": "2026-01-19",
#     "price": 780.1,
#     "segments": [
#       {
#         "origin": "BOS",
#         "destination": "IST",
#         "start_time": "2026-01-19T20:00:00",
#         "end_time": "2026-01-20T13:25:00"
#       },
#       {
#         "origin": "IST",
#         "destination": "SYD",
#         "start_time": "2026-01-20T15:30:00",
#         "end_time": "2026-01-21T19:50:00"
#       }
#     ]
#   },
#   {
#     "airline": "QR",
#     "date": "2026-01-19",
#     "price": 1106.8,
#     "segments": [
#       {
#         "origin": "BOS",
#         "destination": "DOH",
#         "start_time": "2026-01-19T21:05:00",
#         "end_time": "2026-01-20T17:00:00"
#       },
#       {
#         "origin": "DOH",
#         "destination": "SYD",
#         "start_time": "2026-01-20T20:40:00",
#         "end_time": "2026-01-21T18:50:00"
#       }
#     ]
#   },
#   {
#     "airline": "EK",
#     "date": "2026-01-19",
#     "price": 1384.3,
#     "segments": [
#       {
#         "origin": "BOS",
#         "destination": "DXB",
#         "start_time": "2026-01-19T22:10:00",
#         "end_time": "2026-01-20T19:20:00"
#       },
#       {
#         "origin": "DXB",
#         "destination": "SYD",
#         "start_time": "2026-01-20T21:45:00",
#         "end_time": "2026-01-21T18:35:00"
#       }
#     ]
#   },
#   {
#     "airline": "B6",
#     "date": "2026-01-19",
#     "price": 1495.8,
#     "segments": [
#       {
#         "origin": "BOS",
#         "destination": "DOH",
#         "start_time": "2026-01-19T21:05:00",
#         "end_time": "2026-01-20T17:00:00"
#       },
#       {
#         "origin": "DOH",
#         "destination": "SYD",
#         "start_time": "2026-01-20T20:40:00",
#         "end_time": "2026-01-21T18:50:00"
#       }
#     ]
#   },
#   {
#     "airline": "EY",
#     "date": "2026-01-19",
#     "price": 1504.3,
#     "segments": [
#       {
#         "origin": "BOS",
#         "destination": "DCA",
#         "start_time": "2026-01-19T20:00:00",
#         "end_time": "2026-01-19T21:51:00"
#       },
#       {
#         "origin": "IAD",
#         "destination": "AUH",
#         "start_time": "2026-01-20T21:10:00",
#         "end_time": "2026-01-21T19:05:00"
#       },
#       {
#         "origin": "AUH",
#         "destination": "SYD",
#         "start_time": "2026-01-21T21:05:00",
#         "end_time": "2026-01-22T17:55:00"
#       }
#     ]
#   },
#   {
#     "airline": "EY",
#     "date": "2026-01-19",
#     "price": 1504.3,
#     "segments": [
#       {
#         "origin": "BOS",
#         "destination": "DCA",
#         "start_time": "2026-01-19T20:00:00",
#         "end_time": "2026-01-19T21:51:00"
#       },
#       {
#         "origin": "IAD",
#         "destination": "AUH",
#         "start_time": "2026-01-20T21:10:00",
#         "end_time": "2026-01-21T19:05:00"
#       },
#       {
#         "origin": "AUH",
#         "destination": "SYD",
#         "start_time": "2026-01-22T09:50:00",
#         "end_time": "2026-01-23T06:35:00"
#       }
#     ]
#   }
# ]

