#!/bin/bash

# K6 Test Runner Script for SSTAC & TWG Dashboard
# Run with: ./run-k6-tests.sh

set -e

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:3000"}
OUTPUT_DIR="k6-test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}🧪 K6 Test Suite Runner - SSTAC & TWG Dashboard${NC}"
echo -e "${BLUE}================================================${NC}"
echo "Base URL: $BASE_URL"
echo "Output Directory: $OUTPUT_DIR"
echo "Timestamp: $TIMESTAMP"
echo ""

# Function to run a test
run_test() {
    local test_name="$1"
    local test_file="$2"
    local output_file="$3"
    local description="$4"
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    echo "Description: $description"
    echo "Test File: $test_file"
    echo "Output: $output_file"
    echo ""
    
    if k6 run --env BASE_URL="$BASE_URL" "$test_file" --out json="$output_file"; then
        echo -e "${GREEN}✅ $test_name completed successfully${NC}"
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        return 1
    fi
    echo ""
}

# Function to run a test with custom options
run_test_with_options() {
    local test_name="$1"
    local test_file="$2"
    local output_file="$3"
    local description="$4"
    local k6_options="$5"
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    echo "Description: $description"
    echo "Test File: $test_file"
    echo "K6 Options: $k6_options"
    echo "Output: $output_file"
    echo ""
    
    if k6 run $k6_options --env BASE_URL="$BASE_URL" "$test_file" --out json="$output_file"; then
        echo -e "${GREEN}✅ $test_name completed successfully${NC}"
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        return 1
    fi
    echo ""
}

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ K6 is not installed. Please install K6 first.${NC}"
    echo "Visit: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Check if base URL is accessible
echo -e "${BLUE}Checking base URL accessibility...${NC}"
if curl -s --head "$BASE_URL" | head -n 1 | grep -q "200 OK"; then
    echo -e "${GREEN}✅ Base URL is accessible${NC}"
else
    echo -e "${RED}❌ Base URL is not accessible. Please check your server.${NC}"
    exit 1
fi
echo ""

# Test 1: Comprehensive Suite
run_test \
    "Comprehensive Test Suite" \
    "k6-comprehensive-suite.js" \
    "$OUTPUT_DIR/comprehensive-suite-$TIMESTAMP.json" \
    "Complete system testing across all poll types and user scenarios"

# Test 2: Matrix Graph Comprehensive
run_test \
    "Matrix Graph Comprehensive" \
    "k6-matrix-graph-comprehensive.js" \
    "$OUTPUT_DIR/matrix-graph-comprehensive-$TIMESTAMP.json" \
    "Focused testing of matrix graph vote pairing and visualization"

# Test 3: Performance and Load
run_test \
    "Performance and Load Testing" \
    "k6-performance-load.js" \
    "$OUTPUT_DIR/performance-load-$TIMESTAMP.json" \
    "High-load performance testing with up to 100 concurrent users"

# Test 4: Quick Smoke Test (if available)
if [ -f "k6-smoke-test.js" ]; then
    run_test_with_options \
        "Smoke Test" \
        "k6-smoke-test.js" \
        "$OUTPUT_DIR/smoke-test-$TIMESTAMP.json" \
        "Quick smoke test to verify basic functionality" \
        "--iterations 10 --vus 2"
fi

# Test 5: Stress Test (if available)
if [ -f "k6-stress-test.js" ]; then
    run_test_with_options \
        "Stress Test" \
        "k6-stress-test.js" \
        "$OUTPUT_DIR/stress-test-$TIMESTAMP.json" \
        "Stress testing to find system limits" \
        "--duration 10m --vus 200"
fi

# Generate summary report
echo -e "${BLUE}📊 Generating Test Summary Report...${NC}"

SUMMARY_FILE="$OUTPUT_DIR/test-summary-$TIMESTAMP.md"
cat > "$SUMMARY_FILE" << EOF
# K6 Test Results Summary

**Test Date:** $(date)
**Base URL:** $BASE_URL
**Test Duration:** $(date -d @$(($(date +%s) - $(date -d "$TIMESTAMP" +%s))) -u +%H:%M:%S)

## Test Results

### 1. Comprehensive Test Suite
- **File:** comprehensive-suite-$TIMESTAMP.json
- **Description:** Complete system testing across all poll types and user scenarios
- **Status:** $(if [ -f "$OUTPUT_DIR/comprehensive-suite-$TIMESTAMP.json" ]; then echo "✅ Completed"; else echo "❌ Failed"; fi)

### 2. Matrix Graph Comprehensive
- **File:** matrix-graph-comprehensive-$TIMESTAMP.json
- **Description:** Focused testing of matrix graph vote pairing and visualization
- **Status:** $(if [ -f "$OUTPUT_DIR/matrix-graph-comprehensive-$TIMESTAMP.json" ]; then echo "✅ Completed"; else echo "❌ Failed"; fi)

### 3. Performance and Load Testing
- **File:** performance-load-$TIMESTAMP.json
- **Description:** High-load performance testing with up to 100 concurrent users
- **Status:** $(if [ -f "$OUTPUT_DIR/performance-load-$TIMESTAMP.json" ]; then echo "✅ Completed"; else echo "❌ Failed"; fi)

## Test Files Generated

EOF

# List all generated files
for file in "$OUTPUT_DIR"/*.json; do
    if [ -f "$file" ]; then
        echo "- $(basename "$file")" >> "$SUMMARY_FILE"
    fi
done

cat >> "$SUMMARY_FILE" << EOF

## Next Steps

1. Review individual test results in the JSON files
2. Analyze performance metrics and identify bottlenecks
3. Check error rates and failed requests
4. Verify matrix graph pairing accuracy
5. Validate poll submission success rates

## Test Configuration

- **Base URL:** $BASE_URL
- **Output Directory:** $OUTPUT_DIR
- **Test Timestamp:** $TIMESTAMP

EOF

echo -e "${GREEN}✅ Test Summary Report generated: $SUMMARY_FILE${NC}"

# Display final summary
echo ""
echo -e "${BLUE}📋 Test Execution Summary${NC}"
echo -e "${BLUE}========================${NC}"
echo "Total Tests Run: $(ls -1 "$OUTPUT_DIR"/*.json 2>/dev/null | wc -l)"
echo "Output Directory: $OUTPUT_DIR"
echo "Summary Report: $SUMMARY_FILE"
echo ""

# Check for any failed tests
FAILED_TESTS=0
for file in "$OUTPUT_DIR"/*.json; do
    if [ -f "$file" ]; then
        # Check if the file contains error information
        if grep -q '"error"' "$file" 2>/dev/null; then
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    fi
done

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests completed successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  $FAILED_TESTS test(s) may have issues. Please review the results.${NC}"
fi

echo ""
echo -e "${BLUE}🔍 To analyze results:${NC}"
echo "1. Review JSON files in $OUTPUT_DIR"
echo "2. Check the summary report: $SUMMARY_FILE"
echo "3. Use K6's built-in analysis tools or external tools"
echo "4. Focus on error rates, response times, and data accuracy"
echo ""

echo -e "${GREEN}✅ K6 Test Suite execution completed!${NC}"
