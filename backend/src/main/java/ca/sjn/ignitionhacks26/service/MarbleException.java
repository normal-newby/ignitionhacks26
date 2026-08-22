package ca.sjn.ignitionhacks26.service;

/**
 * A Marble call that came back an error. Carries the message Marble actually wrote rather
 * than a status line, because it is usually the useful part — "Unable to read video
 * keyframes" tells the user to reshoot; "422 Unprocessable Entity" does not.
 */
public class MarbleException extends RuntimeException {

    private final int status;

    public MarbleException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
