package ca.sjn.ignitionhacks26.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Controller
public class SpaController {

    @RequestMapping(value = "/")
    public String root() {
        return "forward:/index.html";
    }

}
