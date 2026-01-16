from typing import List
from datetime import date

from data import Airport

from pydantic import BaseModel, Field


class FlightSearchQuery(BaseModel):
    # Change origin to a list of Airport objects
    origins: List[Airport] = Field(
        ...,
        min_length=1,
        description="List of origin Airports"
    )

    # Change destination to a list of Airport objects
    destinations: List[Airport] = Field(
        ...,
        min_length=1,
        description="List of destination Airports"
    )

    # Change departure_date to a list of dates
    departure_dates: List[date] = Field(
        ...,
        min_length=1,
        description="List of dates of departure (YYYY-MM-DD)"
    )