package ca.sjn.ignitionhacks26.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

/** The publish form navigates to /processing?id={tour_id} with this. */
public record PublishTourResponse(@JsonProperty("tour_id") UUID tourId) {}
