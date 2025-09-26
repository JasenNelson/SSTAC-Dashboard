# 📊 Prioritization Matrix Graph System

## 🎯 **System Overview**

The Prioritization Matrix Graph System provides visual analysis of paired importance/feasibility questions from the prioritization poll. It displays five matrix graphs showing how stakeholders rate different sediment protection approaches across two dimensions: importance and feasibility.

## 🏗️ **System Architecture**

### **API Endpoint**
- **Route**: `/api/graphs/prioritization-matrix`
- **Method**: GET
- **Purpose**: Fetches non-aggregated vote data and calculates matrix coordinates

### **Component**
- **File**: `src/components/graphs/PrioritizationMatrixGraph.tsx`
- **Purpose**: Renders individual matrix graph with SVG implementation
- **Props**: `title`, `avgImportance`, `avgFeasibility`, `responses`

### **Integration**
- **Location**: `src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx`
- **Display**: Shows graphs on second question of each pair (poll_index 1, 3, 5, 7, 9)
- **Filtering**: Each graph shows only data for its specific question pair

## 📊 **Question Pairs & Matrix Graphs**

### **Five Question Pairs**
1. **Site-Specific Standards (Bioavailability)**
   - Importance: Question 1 (poll_index 0)
   - Feasibility: Question 2 (poll_index 1)

2. **Matrix Standards (Ecosystem - Direct Toxicity)**
   - Importance: Question 3 (poll_index 2)
   - Feasibility: Question 4 (poll_index 3)

3. **Matrix Standards (Human Health - Direct Toxicity)**
   - Importance: Question 5 (poll_index 4)
   - Feasibility: Question 6 (poll_index 5)

4. **Matrix Standards (Ecosystem - Food-Related)**
   - Importance: Question 7 (poll_index 6)
   - Feasibility: Question 8 (poll_index 7)

5. **Matrix Standards (Human Health - Food-Related)**
   - Importance: Question 9 (poll_index 8)
   - Feasibility: Question 10 (poll_index 9)

## 🔄 **Data Processing Flow**

### **1. Vote Collection**
```typescript
// Fetches votes from both survey and CEW paths
const { data: votes } = await supabase
  .from('poll_votes')
  .select(`
    user_id,
    option_index,
    polls!inner(poll_index)
  `)
  .in('polls.page_path', [
    '/survey-results/prioritization',
    '/cew-polls/prioritization'
  ]);
```

### **2. User Grouping**
```typescript
// Groups votes by user for pairing
const votesByUser = new Map<string, Map<number, number>>();
for (const vote of votes) {
  if (!votesByUser.has(vote.user_id)) {
    votesByUser.set(vote.user_id, new Map());
  }
  votesByUser.get(vote.user_id)!.set(vote.polls.poll_index, vote.option_index + 1);
}
```

### **3. Scale Inversion**
```typescript
// Inverts 1-5 scale (1=high, 5=low) for proper graph mapping
const importanceScore = 6 - userVotes.get(pair.importanceIndex)!;
const feasibilityScore = 6 - userVotes.get(pair.feasibilityIndex)!;
```

### **4. Average Calculation**
```typescript
// Calculates average importance and feasibility for each pair
const avgImportance = totalImportance / validPairedVotes.length;
const avgFeasibility = totalFeasibility / validPairedVotes.length;
```

## 🎨 **Visual Design**

### **Graph Layout**
- **Aspect Ratio**: 16:9 landscape orientation
- **SVG Dimensions**: 800x450 pixels
- **Safe Plotting Area**: 120-680px (x-axis), 120-400px (y-axis)
- **Data Point**: Blue circle with white border, 12px radius

### **Axes & Labels**
- **X-Axis**: "Feasible" (horizontal, bottom)
- **Y-Axis**: "Important" (vertical, left)
- **Axis Lines**: Solid black lines, 4px width
- **Dashed Dividers**: Grey lines dividing quadrants

### **Quadrant Labels**
- **Top-Left**: "LONGER-TERM" (very important but not currently feasible)
- **Top-Right**: "HIGH PRIORITY NEAR-TERM" (very important and feasible now) - **GREEN**
- **Bottom-Left**: "NO GO" (not currently important or feasible) - **RED**
- **Bottom-Right**: "POSSIBLY LATER?" (highly feasible but not currently important)

### **Color Scheme**
- **Light Mode**: Black axes, white background, colored quadrant text
- **Dark Mode**: White axes, dark background, light text
- **Data Point**: Blue (#2563eb) with white border
- **HIGH PRIORITY**: Green (#059669)
- **NO GO**: Red (#dc2626)

## 🌙 **Dark Mode Support**

### **Dynamic Theming**
```typescript
const [isDarkMode, setIsDarkMode] = useState(false);

useEffect(() => {
  const checkDarkMode = () => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  };
  
  checkDarkMode();
  
  const observer = new MutationObserver(checkDarkMode);
  observer.observe(document.documentElement, { 
    attributes: true, 
    attributeFilter: ['class'] 
  });
  
  return () => observer.disconnect();
}, []);
```

### **Color Adaptation**
```typescript
const colors = {
  background: isDarkMode ? '#1f2937' : 'white',
  axis: isDarkMode ? '#ffffff' : '#000000',
  text: isDarkMode ? '#ffffff' : '#374151',
  textSecondary: isDarkMode ? '#d1d5db' : '#6b7280',
  highPriority: '#059669', // Green stays the same
  noGo: '#dc2626', // Red stays the same
  dataPoint: '#2563eb' // Blue stays the same
};
```

## 📱 **Responsive Design**

### **Container Sizing**
- **Admin Panel**: `max-w-4xl` for optimal landscape utilization
- **Grid Layout**: Responsive grid with 1-5 columns based on screen size
- **Text Wrapping**: Quadrant descriptions wrap to multiple lines as needed

### **Font Sizing**
- **Graph Title**: `text-base` (16px)
- **Axis Labels**: 20px font size
- **Quadrant Titles**: 18px font size
- **Quadrant Descriptions**: 14px font size
- **Response Count**: `text-base` (16px)

## 🔧 **Technical Implementation**

### **SVG Rendering**
- **Custom Implementation**: No external image dependencies
- **Dynamic Positioning**: Data points positioned based on calculated coordinates
- **Collision Avoidance**: Safe plotting area prevents data points from being cut off
- **Accessibility**: Title attributes for data point tooltips

### **Data Validation**
- **Paired Votes Only**: Only includes users who voted on both questions in pair
- **Response Tracking**: Displays number of paired responses used for calculations
- **Error Handling**: Graceful handling of missing or invalid data

### **Performance Optimization**
- **Single API Call**: Fetches all data in one request
- **Efficient Processing**: Groups and calculates data server-side
- **Minimal Re-renders**: Only updates when data changes

## 🚀 **Usage in Admin Panel**

### **Display Logic**
```typescript
// Shows graphs only on second question of each pair
{theme.showGraphs && themeId === 'prioritization' && matrixData.length > 0 && (
  <div className="mb-8 p-4 border-2 border-dashed rounded-lg">
    <h3 className="text-xl font-bold text-center mb-4">
      Prioritization Matrix Results
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {matrixData.map((graph) => (
        <PrioritizationMatrixGraph key={graph.title} {...graph} />
      ))}
    </div>
  </div>
)}
```

### **Question-Specific Filtering**
```typescript
// Filters matrix data to show only relevant graph for selected question
const currentGraphData = matrixData.filter((graph, index) => {
  const questionPairIndex = Math.floor(selectedPollIndex / 2);
  return index === questionPairIndex;
});
```

## 📈 **Benefits**

### **Visual Analysis**
- **Quick Assessment**: Immediate visual understanding of stakeholder priorities
- **Pattern Recognition**: Easy identification of consensus areas
- **Decision Support**: Clear guidance for prioritization decisions

### **Stakeholder Engagement**
- **Interactive Display**: Engaging visual representation for presentations
- **Real-time Updates**: Graphs update as new votes are submitted
- **Professional Appearance**: Government-appropriate visual design

### **Data Insights**
- **Paired Analysis**: Shows relationship between importance and feasibility
- **Response Tracking**: Indicates level of stakeholder participation
- **Trend Identification**: Helps identify areas of agreement or disagreement

## 🔮 **Future Enhancements**

### **Potential Improvements**
- **Interactive Tooltips**: Hover details for data points
- **Export Capabilities**: Save graphs as images or PDFs
- **Historical Tracking**: Compare results over time
- **Custom Styling**: User-configurable color schemes
- **Animation**: Smooth transitions when data updates

### **Advanced Features**
- **Confidence Intervals**: Show uncertainty in positioning
- **Subgroup Analysis**: Separate graphs for different user types
- **Statistical Analysis**: Advanced metrics and correlations
- **Integration**: Connect with other dashboard analytics

## 📝 **Key Takeaways**

1. **Custom SVG Implementation**: No external dependencies, fully responsive
2. **User-by-User Pairing**: Ensures accurate representation of stakeholder views
3. **Scale Inversion**: Critical for proper graph interpretation
4. **Dark Mode Support**: Dynamic theming for all user preferences
5. **Question-Specific Display**: Each graph shows only relevant data
6. **Professional Design**: Government-appropriate visual styling
7. **Performance Optimized**: Efficient data processing and rendering

This system provides a powerful visual tool for understanding stakeholder priorities and making informed decisions about sediment protection approaches.
