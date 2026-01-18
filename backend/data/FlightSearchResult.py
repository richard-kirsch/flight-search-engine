from pydantic import BaseModel
from datetime import date, datetime
from typing import List

class FlightSegment(BaseModel):
    origin: str
    destination: str
    start_time: datetime
    end_time: datetime

class FlightSearchResult(BaseModel):
    airline: str
    date: date
    price: float
    segments: List[FlightSegment]