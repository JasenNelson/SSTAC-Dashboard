#!/bin/bash

# K6 Poll System Test Runner
# This script provides easy commands to run different k6 test scenarios

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BASE_URL="https://sstac-dashboard.vercel.app"
DURATION="5m"
VUS="20"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if k6 is installed
check_k6() {
    if ! command -v k6 &> /dev/null; then
        print_error "k6 is not installed. Please install k6 first."
        print_status "Installation instructions:"
        echo "  Windows: choco install k6"
        echo "  macOS: brew install k6"
        echo "  Linux: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    print_success "k6 is installed and ready"
}

# Function to run authentication test
run_auth_test() {
    print_status "Running authentication test..."
    print_warning "This test verifies that survey-results pages require authentication"
    print_warning "and CEW pages work with authCode"
    
    k6 run -e BASE_URL="$BASE_URL" k6-authentication-test.js
    
    if [ $? -eq 0 ]; then
        print_success "Authentication test completed successfully"
    else
        print_error "Authentication test failed"
        exit 1
    fi
}

# Function to run wordcloud focused test
run_wordcloud_test() {
    print_status "Running wordcloud focused test..."
    print_warning "This test focuses on wordcloud poll functionality"
    
    k6 run -e BASE_URL="$BASE_URL" k6-wordcloud-focused-test.js
    
    if [ $? -eq 0 ]; then
        print_success "Wordcloud test completed successfully"
    else
        print_error "Wordcloud test failed"
        exit 1
    fi
}

# Function to run comprehensive test
run_comprehensive_test() {
    print_status "Running comprehensive poll system test..."
    print_warning "This test covers all poll types and pages with load testing"
    
    k6 run -e BASE_URL="$BASE_URL" k6-poll-system-test.js
    
    if [ $? -eq 0 ]; then
        print_success "Comprehensive test completed successfully"
    else
        print_error "Comprehensive test failed"
        exit 1
    fi
}

# Function to run custom test
run_custom_test() {
    local test_file=$1
    local duration=$2
    local vus=$3
    
    if [ ! -f "$test_file" ]; then
        print_error "Test file $test_file not found"
        exit 1
    fi
    
    print_status "Running custom test: $test_file"
    print_status "Duration: $duration, VUs: $vus"
    
    k6 run -e BASE_URL="$BASE_URL" --duration "$duration" --vus "$vus" "$test_file"
    
    if [ $? -eq 0 ]; then
        print_success "Custom test completed successfully"
    else
        print_error "Custom test failed"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "K6 Poll System Test Runner"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  auth                    Run authentication test"
    echo "  wordcloud              Run wordcloud focused test"
    echo "  comprehensive          Run comprehensive poll system test"
    echo "  custom <file> <duration> <vus>  Run custom test"
    echo "  help                   Show this help message"
    echo ""
    echo "Options:"
    echo "  --url <url>            Set base URL (default: $BASE_URL)"
    echo "  --duration <duration>  Set test duration (default: $DURATION)"
    echo "  --vus <vus>           Set number of virtual users (default: $VUS)"
    echo ""
    echo "Examples:"
    echo "  $0 auth"
    echo "  $0 wordcloud --url https://staging.example.com"
    echo "  $0 comprehensive --duration 10m --vus 50"
    echo "  $0 custom k6-poll-system-test.js 5m 30"
    echo ""
    echo "Test Files:"
    echo "  k6-authentication-test.js     - Authentication validation"
    echo "  k6-wordcloud-focused-test.js  - Wordcloud functionality"
    echo "  k6-poll-system-test.js        - Comprehensive system test"
}

# Main script logic
main() {
    # Check if k6 is installed
    check_k6
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --url)
                BASE_URL="$2"
                shift 2
                ;;
            --duration)
                DURATION="$2"
                shift 2
                ;;
            --vus)
                VUS="$2"
                shift 2
                ;;
            auth)
                run_auth_test
                exit 0
                ;;
            wordcloud)
                run_wordcloud_test
                exit 0
                ;;
            comprehensive)
                run_comprehensive_test
                exit 0
                ;;
            custom)
                if [ $# -lt 4 ]; then
                    print_error "Custom test requires: <file> <duration> <vus>"
                    exit 1
                fi
                run_custom_test "$2" "$3" "$4"
                exit 0
                ;;
            help|--help|-h)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown command: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # If no command provided, show help
    show_help
}

# Run main function with all arguments
main "$@"
