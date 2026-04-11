# Dummy Data Visualization Guide

## Overview
The dashboard now supports **dummy data mode** for visualization and testing purposes. This allows you to see how the dashboard looks with realistic data before connecting to your actual Firebase database.

## Current Status
✅ **Dummy Data Mode is ENABLED** (set to `true`)

The dashboard will display:
- **120 dummy trees** across 8 species
- **50 dummy applications** across 5 types (CTPO, PLTP, SPLT, Permit to Cut, Chainsaw)
- **30 dummy appointments** with various types and statuses
- **15 foresters** and **45 applicants**
- Trees spread across **10 municipalities** in Cagayan
- Realistic date ranges (last 90 days)
- Monthly growth calculations
- Recent activities timeline

## How to Toggle Between Dummy and Real Data

### Option 1: Switch to Real Firebase Data
To use real data from your Firebase database:

1. Open `js/dashboard.js`
2. Find these lines (around line 86 and 137):
   ```javascript
   const USE_DUMMY_DATA = true;
   ```
3. Change to:
   ```javascript
   const USE_DUMMY_DATA = false;
   ```
4. Save the file

You need to change it in **3 locations**:
- Line ~86: `loadApplicationsData()` function
- Line ~137: `loadAppointmentsData()` function  
- Line ~161: `loadTreeStats()` function

### Option 2: Quick Search & Replace
1. Open `js/dashboard.js`
2. Press `Ctrl+H` (Find and Replace)
3. Find: `const USE_DUMMY_DATA = true;`
4. Replace with: `const USE_DUMMY_DATA = false;`
5. Replace All (should find 3 instances)
6. Save the file

## Dummy Data Details

### Trees (120 total)
- **Species**: Narra, Mahogany, Acacia, Pine, Mango, Teak, Bamboo, Eucalyptus
- **Foresters**: Juan Dela Cruz, Maria Santos, Pedro Reyes, Ana Garcia, Jose Mendoza, Rosa Aquino
- **Locations**: Distributed across Aparri, Camalanuigan, Buguey, Sta Teresita, Gonzaga, Sta Ana, Lallo, Gattaran, Lasam, Allacapan
- **Dates**: Tagged within the last 90 days
- **Measurements**: Heights 5-25m, Diameters 10-50cm
- **Map**: Trees plotted with realistic coordinates around each municipality

### Applications (50 total)
- **Types**: 
  - CTPO (Certificate of Tree Plantation Ownership)
  - PLTP (Private Land Timber Permit)
  - SPLT (Special Private Land Timber)
  - Permit to Cut
  - Chainsaw Registration
- **Statuses**: Pending, Approved, Denied, Under Review
- **Dates**: Created within the last 60 days
- **Distribution**: Random but realistic across all types

### Appointments (30 total)
- **Types**: Tree Inspection, Site Visit, Consultation, Permit Review, Field Assessment
- **Statuses**: Active, Scheduled, Completed, Done
- **Locations**: Distributed across municipalities
- **Split**: ~50% active/scheduled, ~50% completed/done

## What Gets Displayed

### Summary Cards (12)
- Total Tagged Trees: 120
- Total Foresters: 15
- Total Applicants: 45
- Species Count: 8
- Calculated averages and monthly metrics

### Application Type Breakdown
Shows realistic distribution across all 5 application types

### Charts (4)
1. **Species Distribution** - Pie chart with 8 species
2. **Forester Performance** - Bar chart with 6 foresters
3. **Application Status** - Doughnut chart showing status breakdown
4. **Appointment Types** - Bar chart with 5 appointment types

### Top Performers
- Most Active Forester (with tree count)
- Most Common Species (with tree count)
- Most Active Location (with tree count)

### Map
- 120 tree markers plotted across Cagayan municipalities
- Markers clustered realistically around each municipality center
- Interactive tooltips with tree details
- Filter functionality works with dummy data

### Monthly Comparison
- Shows growth/decline percentages
- Compares this month vs last month
- Realistic trends based on date generation

### Recent Activities (10 items)
- Mix of tree taggings and application submissions
- Sorted by date (most recent first)
- Shows time ago (e.g., "2 days ago", "1 week ago")

## Benefits of Dummy Data Mode

✅ **Visual Testing** - See how dashboard looks fully populated
✅ **Development** - Test UI without database connection
✅ **Demo** - Show stakeholders without real data
✅ **Performance** - Fast loading for UI/UX testing
✅ **Training** - Use for user training sessions

## Switching Back to Real Data

When you're ready to use real Firebase data:
1. Change all 3 `USE_DUMMY_DATA = true` to `false`
2. Ensure Firebase configuration is correct in `js/firebase-config.js`
3. Verify Firebase collections structure matches:
   - `users/{userId}/tree_inventory/{treeId}`
   - `applications/{type}/applicants/{id}`
   - `appointments/{appointmentId}`
4. Save and refresh the dashboard

## Notes

- Dummy data is generated fresh each time the page loads
- Random distributions may vary slightly on each refresh
- All calculations (averages, percentages, etc.) work identically with dummy data
- The map functionality remains fully interactive
- Filters work normally with dummy data
- Export functionality will export the dummy data

## Troubleshooting

**Issue**: Charts not showing
- **Solution**: Check browser console for errors, ensure Chart.js is loaded

**Issue**: Map not displaying trees
- **Solution**: Verify Leaflet.js is loaded, check coordinate ranges

**Issue**: Recent activities empty
- **Solution**: Ensure dummy data generation completed, check console

**Issue**: Want different dummy data
- **Solution**: Modify the generation code in `loadTreeStats()` function to adjust:
  - Number of trees (change loop from 120 to desired count)
  - Species list (modify the `species` array)
  - Date ranges (adjust `daysAgo` calculation)
  - Forester names (modify the `foresters` array)

---

**Created**: November 6, 2025  
**Last Updated**: November 6, 2025  
**Version**: 1.0
