package ca.sjn.ignitionhacks26.controller;

import ca.sjn.ignitionhacks26.entity.CustomerEntity;
import ca.sjn.ignitionhacks26.service.CustomerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin(origins = "http://localhost:8080")
@RequestMapping("/api/customer")
public class CustomerController {

    @Autowired
    private CustomerService customerService;

    @GetMapping("/{name}")
    public CustomerEntity getCustomer(@PathVariable String name){
        return customerService.getCustomer(name);
    }

    @PostMapping
    public ResponseEntity<?> addCustomer(@RequestBody CustomerEntity customer){
        return customerService.addCustomer(customer);
    }
}
