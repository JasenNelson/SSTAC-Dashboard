import math
from pyproj import Transformer

def haversine_distance(lat1, lon1, lat2, lon2):
    # Radius of Earth in meters
    R = 6371000.0
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = (math.sin(dphi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(dlambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    
    return R * c

def main():
    print("Running projection control-point verification...")
    
    # Control point: Site 6137 metes-and-bounds start
    # Easting 453782.4, Northing 5463108.2, Zone 11, NAD83 (EPSG:26911)
    utm_east = 453782.4
    utm_north = 5463108.2
    
    # 1. Transform UTM to WGS84 (EPSG:4326)
    transformer = Transformer.from_crs("epsg:26911", "epsg:4326", always_xy=True)
    lon_conv, lat_conv = transformer.transform(utm_east, utm_north)
    print(f"UTM Converted: Latitude = {lat_conv:.6f}, Longitude = {lon_conv:.6f}")
    
    # 2. Convert report stated DMS to decimal degrees
    # Latitude: 49 deg 19' 7.5\" N -> 49 + 19/60 + 7.5/3600 = 49.31875
    # Longitude: 117 deg 38' 5.5\" W -> -(117 + 38/60 + 5.5/3600) = -117.634861
    lat_dms = 49.0 + (19.0 / 60.0) + (7.5 / 3600.0)
    lon_dms = -(117.0 + (38.0 / 60.0) + (5.5 / 3600.0))
    print(f"Report Stated DMS Decimals: Latitude = {lat_dms:.6f}, Longitude = {lon_dms:.6f}")
    
    # 3. Calculate distance
    dist = haversine_distance(lat_conv, lon_conv, lat_dms, lon_dms)
    print(f"Haversine distance between UTM-converted and stated DMS: {dist:.2f} meters")
    
    # 4. Assert distance is within 100 meters
    tolerance = 100.0
    if dist <= tolerance:
        print("PASS: Converted UTM coordinate is within 100m tolerance of stated DMS coordinate.")
        return 0
    else:
        print(f"FAIL: Distance {dist:.2f}m exceeds tolerance of {tolerance}m.")
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(main())
