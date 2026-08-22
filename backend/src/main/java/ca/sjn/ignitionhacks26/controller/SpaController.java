package ca.sjn.ignitionhacks26.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Hands every non-API path to the React bundle so client-side routes survive a hard reload —
 * hitting /editor/{id} directly has to work, not just navigating there from within the app.
 */
@Controller
public class SpaController {

    @RequestMapping(value = {"/", "/login", "/rooms", "/upload", "/catalog",
            "/processing/**", "/editor/**"})
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}
