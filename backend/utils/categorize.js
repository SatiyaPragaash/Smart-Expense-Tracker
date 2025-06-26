function categorizeTransaction(merchant) {
    const rules = [
      { keyword: "Uber", category: "Transport" },
      { keyword: "Lyft", category: "Transport" },
      { keyword: "Walmart", category: "Groceries" },
      { keyword: "Costco", category: "Groceries" },
      { keyword: "Netflix", category: "Entertainment" },
      { keyword: "Spotify", category: "Entertainment" },
      { keyword: "Hydro", category: "Utilities" },
      { keyword: "Restaurant", category: "Dining" },
      { keyword: "McDonalds", category: "Dining" }
    ];
  
    for (const rule of rules) {
      if (merchant.toLowerCase().includes(rule.keyword.toLowerCase())) {
        return rule.category;
      }
    }
    return "Other";
  }
  
  module.exports = categorizeTransaction;
  