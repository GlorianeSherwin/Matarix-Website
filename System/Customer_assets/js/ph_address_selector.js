/**
 * Philippine Address Selector - Reusable Version
 * Based on philippine-address-selector functionality
 * Supports Central Luzon (Region III) and NCR (National Capital Region)
 * Can be initialized with different field ID prefixes
 */

function initializeAddressSelector(prefix) {
    // Default prefix if not provided
    prefix = prefix || '';
    
    // Build field IDs with prefix
    var regionId, districtId, cityId, barangayId;
    
    if (!prefix || prefix === '') {
        // Registration form or CustomerProfile - use address_ prefix
        regionId = '#address_region';
        districtId = '#address_district';
        cityId = '#address_city';
        barangayId = '#address_barangay';
    } else {
        // Edit or Add user modal - use prefix directly
        regionId = '#' + prefix + 'Region';
        districtId = '#' + prefix + 'District';
        cityId = '#' + prefix + 'City';
        barangayId = '#' + prefix + 'Barangay';
    }
    
    var handlers = {
        // Fill provinces/districts based on selected region
        fill_provinces: function() {
            // Selected region
            var region_name = $(this).val();
            
            // Province/District dropdown
            let dropdown = $(districtId);
            dropdown.empty();
            dropdown.append('<option value="">Select Province/District</option>');
            dropdown.prop('selectedIndex', 0);

            // Clear city and barangay dropdowns
            let city = $(cityId);
            city.empty();
            city.append('<option value="">Select City/Municipality</option>');
            city.prop('selectedIndex', 0);

            let barangay = $(barangayId);
            barangay.empty();
            barangay.append('<option value="">Select Barangay</option>');
            barangay.prop('selectedIndex', 0);

            if (!region_name) {
                return;
            }

            // Central Luzon provinces (Region III - region_code: "03")
            if (region_name === 'Region III (Central Luzon)') {
                const centralLuzonProvinces = [
                    { code: '0308', name: 'Bataan' },
                    { code: '0314', name: 'Bulacan' },
                    { code: '0349', name: 'Nueva Ecija' },
                    { code: '0354', name: 'Pampanga' },
                    { code: '0369', name: 'Tarlac' },
                    { code: '0371', name: 'Zambales' },
                    { code: '0377', name: 'Aurora' }
                ];

                // Sort by name
                centralLuzonProvinces.sort(function(a, b) {
                    return a.name.localeCompare(b.name);
                });

                // Populate dropdown
                $.each(centralLuzonProvinces, function(key, entry) {
                    dropdown.append($('<option></option>').attr('value', entry.name).attr('data-code', entry.code).text(entry.name));
                });
            }
            // NCR Districts (region_code: "13")
            else if (region_name === 'National Capital Region (NCR)') {
                const ncrDistricts = [
                    { code: '1339', name: 'NCR, City Of Manila, First District' },
                    { code: '1374', name: 'NCR, Second District' },
                    { code: '1375', name: 'NCR, Third District' },
                    { code: '1376', name: 'NCR, Fourth District' }
                ];

                // Populate dropdown
                $.each(ncrDistricts, function(key, entry) {
                    dropdown.append($('<option></option>').attr('value', entry.name).attr('data-code', entry.code).text(entry.name));
                });
            }
        },

        // Fill cities based on selected province/district
        fill_cities: function() {
            // Selected province/district
            var province_name = $(this).val();
            var province_code = $(this).find('option:selected').attr('data-code');

            // Clear city and barangay dropdowns
            let city = $(cityId);
            city.empty();
            city.append('<option value="">Select City/Municipality</option>');
            city.prop('selectedIndex', 0);

            let barangay = $(barangayId);
            barangay.empty();
            barangay.append('<option value="">Select Barangay</option>');
            barangay.prop('selectedIndex', 0);

            if (!province_name || !province_code) {
                return;
            }

            // Prevent duplicate loading by checking if already loading
            if (city.data('loading')) {
                return;
            }
            city.data('loading', true);

            // Determine JSON path based on current page location
            var jsonPath = '';
            if (window.location.pathname.includes('/Admin/')) {
                jsonPath = '../philippine-address-selector-main/ph-json/city.json';
            } else {
                jsonPath = '../philippine-address-selector-main/ph-json/city.json';
            }

            // Load cities from JSON
            $.getJSON(jsonPath, function(data) {
                // Clear again to ensure no duplicates
                city.empty();
                city.append('<option value="">Select City/Municipality</option>');
                
                var result = data.filter(function(value) {
                    return value.province_code == province_code;
                });

                // Remove duplicates by city_name
                var uniqueCities = [];
                var seenCities = {};
                result.forEach(function(item) {
                    if (!seenCities[item.city_name]) {
                        seenCities[item.city_name] = true;
                        uniqueCities.push(item);
                    }
                });

                uniqueCities.sort(function(a, b) {
                    return a.city_name.localeCompare(b.city_name);
                });

                $.each(uniqueCities, function(key, entry) {
                    city.append($('<option></option>')
                        .attr('value', entry.city_name)
                        .attr('data-code', entry.city_code)
                        .text(entry.city_name));
                });
                
                city.data('loading', false);
            }).fail(function() {
                console.error('Failed to load cities data');
                city.data('loading', false);
            });
        },

        // Fill barangays based on selected city
        fill_barangays: function() {
            // Selected city
            var city_name = $(this).val();
            var city_code = $(this).find('option:selected').attr('data-code');

            // Clear barangay dropdown
            let barangay = $(barangayId);
            barangay.empty();
            barangay.append('<option value="">Select Barangay</option>');
            barangay.prop('selectedIndex', 0);

            if (!city_name || !city_code) {
                return;
            }

            // Prevent duplicate loading by checking if already loading
            if (barangay.data('loading')) {
                return;
            }
            barangay.data('loading', true);

            // Determine JSON path based on current page location
            var jsonPath = '';
            if (window.location.pathname.includes('/Admin/')) {
                jsonPath = '../philippine-address-selector-main/ph-json/barangay.json';
            } else {
                jsonPath = '../philippine-address-selector-main/ph-json/barangay.json';
            }

            // Load barangays from JSON
            $.getJSON(jsonPath, function(data) {
                // Clear again to ensure no duplicates
                barangay.empty();
                barangay.append('<option value="">Select Barangay</option>');
                
                var result = data.filter(function(value) {
                    return value.city_code == city_code;
                });

                // Remove duplicates by brgy_name
                var uniqueBarangays = [];
                var seenBarangays = {};
                result.forEach(function(item) {
                    if (!seenBarangays[item.brgy_name]) {
                        seenBarangays[item.brgy_name] = true;
                        uniqueBarangays.push(item);
                    }
                });

                uniqueBarangays.sort(function(a, b) {
                    return a.brgy_name.localeCompare(b.brgy_name);
                });

                $.each(uniqueBarangays, function(key, entry) {
                    barangay.append($('<option></option>')
                        .attr('value', entry.brgy_name)
                        .text(entry.brgy_name));
                });
                
                barangay.data('loading', false);
            }).fail(function() {
                console.error('Failed to load barangays data');
                barangay.data('loading', false);
            });
        }
    };

    // Initialize region dropdown
    let regionDropdown = $(regionId);
    if (regionDropdown.length > 0) {
        // Only initialize if element exists
        regionDropdown.empty();
        regionDropdown.append('<option value="">Select Region</option>');
        
        // Add Central Luzon and NCR options
        regionDropdown.append($('<option></option>').attr('value', 'Region III (Central Luzon)').text('Region III (Central Luzon)'));
        regionDropdown.append($('<option></option>').attr('value', 'National Capital Region (NCR)').text('National Capital Region (NCR)'));

        // Event handlers
        $(regionId).off('change', handlers.fill_provinces).on('change', handlers.fill_provinces);
        $(districtId).off('change', handlers.fill_cities).on('change', handlers.fill_cities);
        $(cityId).off('change', handlers.fill_barangays).on('change', handlers.fill_barangays);
    }
    
    return handlers;
}

// Helper function to set address values (for editing existing data)
function setAddressValues(prefix, addressData) {
    prefix = prefix || '';
    
    var regionId, districtId, cityId, barangayId;
    
    if (!prefix || prefix === '') {
        regionId = '#address_region';
        districtId = '#address_district';
        cityId = '#address_city';
        barangayId = '#address_barangay';
    } else {
        regionId = '#' + prefix + 'Region';
        districtId = '#' + prefix + 'District';
        cityId = '#' + prefix + 'City';
        barangayId = '#' + prefix + 'Barangay';
    }
    
    if (!addressData) return;
    
    // Set region first, then trigger cascade
    if (addressData.address_region) {
        $(regionId).val(addressData.address_region).trigger('change');
        
        // Wait a bit for provinces to load, then set district
        setTimeout(function() {
            if (addressData.address_district) {
                $(districtId).val(addressData.address_district).trigger('change');
                
                // Wait for cities to load, then set city
                setTimeout(function() {
                    if (addressData.address_city) {
                        $(cityId).val(addressData.address_city).trigger('change');
                        
                        // Wait for barangays to load, then set barangay
                        setTimeout(function() {
                            if (addressData.address_barangay) {
                                $(barangayId).val(addressData.address_barangay);
                            }
                        }, 800);
                    }
                }, 800);
            }
        }, 800);
    }
}

