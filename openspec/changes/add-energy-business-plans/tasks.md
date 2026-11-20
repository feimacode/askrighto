## 1. Data
- [x] 1.1 Store RESIDENTIAL and BUSINESS plans; skip others
- [x] 1.2 Postcode lookups filter on customer type, default RESIDENTIAL
- [x] 1.3 `renormalise-energy` keeps the stored customer type
- [x] 1.4 Tests: sync stores both; default lookup is residential; business lookup returns only business

## 2. Tools
- [x] 2.1 `customerType` on `search_energy_plans` and `compare_energy_plans`
- [x] 2.2 BUSINESS with no usage asks for a bill or readings
- [x] 2.3 Instructions and skill: ask the user to pick residential or business; large customers not compared; business has no typical usage

## 3. Docs and open checks
- [x] 3.1 Update docs that say residential only
- [ ] 3.3 After deploy: run `sync-energy` once on the VM, then check business plan counts per retailer
