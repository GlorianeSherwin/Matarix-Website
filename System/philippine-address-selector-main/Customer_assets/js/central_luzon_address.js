/**
 * Philippine Address Selector for Central Luzon and NCR
 * Based on philippine-address-selector functionality
 * Includes Central Luzon (Region III) and NCR (National Capital Region)
 */

var addressHandlers = {
    // Fill provinces/districts based on selected region
    fill_provinces: function() {
        // Selected region
        var region_name = $(this).val();
        
        // Province/District dropdown
        let dropdown = $('#address_district');
        dropdown.empty();
        dropdown.append('<option value="">Select Province/District</option>');
        dropdown.prop('selectedIndex', 0);

        // Clear city and barangay dropdowns
        let city = $('#address_city');
        city.empty();
        city.append('<option value="">Select City/Municipality</option>');
        city.prop('selectedIndex', 0);

        let barangay = $('#address_barangay');
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
        let city = $('#address_city');
        city.empty();
        city.append('<option value="">Select City/Municipality</option>');
        city.prop('selectedIndex', 0);

        let barangay = $('#address_barangay');
        barangay.empty();
        barangay.append('<option value="">Select Barangay</option>');
        barangay.prop('selectedIndex', 0);

        if (!province_name || !province_code) {
            return;
        }

        // Load cities from JSON
        var url = '../philippine-address-selector-main/ph-json/city.json';
        $.getJSON(url, function(data) {
            var result = data.filter(function(value) {
                return value.province_code == province_code;
            });

            result.sort(function(a, b) {
                return a.city_name.localeCompare(b.city_name);
            });

            $.each(result, function(key, entry) {
                city.append($('<option></option>')
                    .attr('value', entry.city_name)
                    .attr('data-code', entry.city_code)
                    .text(entry.city_name));
            });
        }).fail(function() {
            console.error('Failed to load cities data');
        });
    },

    // Fill barangays based on selected city
    fill_barangays: function() {
        // Selected city
        var city_name = $(this).val();
        var city_code = $(this).find('option:selected').attr('data-code');

        // Clear barangay dropdown
        let barangay = $('#address_barangay');
        barangay.empty();
        barangay.append('<option value="">Select Barangay</option>');
        barangay.prop('selectedIndex', 0);

        if (!city_name || !city_code) {
            return;
        }

        // Load barangays from JSON
        var url = '../philippine-address-selector-main/ph-json/barangay.json';
        $.getJSON(url, function(data) {
            var result = data.filter(function(value) {
                return value.city_code == city_code;
            });

            result.sort(function(a, b) {
                return a.brgy_name.localeCompare(b.brgy_name);
            });

            $.each(result, function(key, entry) {
                barangay.append($('<option></option>')
                    .attr('value', entry.brgy_name)
                    .text(entry.brgy_name));
            });
        }).fail(function() {
            console.error('Failed to load barangays data');
        });
    }
};

$(document).ready(function() {
    // Load regions on page load
    let regionDropdown = $('#address_region');
    regionDropdown.empty();
    regionDropdown.append('<option value="">Select Region</option>');
    
    // Add Central Luzon and NCR options
    regionDropdown.append($('<option></option>').attr('value', 'Region III (Central Luzon)').text('Region III (Central Luzon)'));
    regionDropdown.append($('<option></option>').attr('value', 'National Capital Region (NCR)').text('National Capital Region (NCR)'));

    // Event handlers
    $('#address_region').on('change', addressHandlers.fill_provinces);
    $('#address_district').on('change', addressHandlers.fill_cities);
    $('#address_city').on('change', addressHandlers.fill_barangays);
});

