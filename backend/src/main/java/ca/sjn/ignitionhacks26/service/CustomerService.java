package ca.sjn.ignitionhacks26.service;

import ca.sjn.ignitionhacks26.entity.CustomerEntity;
import ca.sjn.ignitionhacks26.repository.CustomerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
public class CustomerService {

    @Autowired
    private CustomerRepository customerRepository;

    public ResponseEntity<?> addCustomer(CustomerEntity customer){
        try {
            customerRepository.save(customer);
            return ResponseEntity.ok().body("Saved");
        } catch (Exception e){
            return ResponseEntity.badRequest().body("Cannot save");
        }
    }

    public CustomerEntity getCustomer(String name){
        try {
            CustomerEntity customer = customerRepository.findByName(name);
            System.out.println(customer);
            return customer;
        } catch (Exception e){
            e.printStackTrace();
            return null;
        }
    }
}
