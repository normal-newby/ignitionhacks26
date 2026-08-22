package ca.sjn.ignitionhacks26.dto;

import ca.sjn.ignitionhacks26.entity.TourEntity;

/** Polled every 5s by the processing screen. */
public record TourStatusResponse(String status, String description, String address) {

    public static TourStatusResponse from(TourEntity tour) {
        return new TourStatusResponse(
                tour.getStatus().wireValue(),
                tour.getDescription(),
                tour.getAddress()
        );
    }
}
