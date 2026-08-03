const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/ProjectEnjazTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Extract Quick Points section
const qpStartIdx = content.indexOf('{/* Sub-section: Quick Points */}');
const qpEndIdx = content.indexOf('{/* Sub-section: Audit Log */}');
if (qpStartIdx === -1 || qpEndIdx === -1) {
    console.error('Could not find Quick Points or Audit Log boundaries');
    process.exit(1);
}
const quickPointsContent = content.substring(qpStartIdx, qpEndIdx);
content = content.substring(0, qpStartIdx) + content.substring(qpEndIdx);

// 2. Extract Store & Rewards section
const storeStartIdx = content.indexOf('{/* ========================================================\n            SECTION 5: REWARDS & BADGES');
const storeEndIdx = content.indexOf('{/* ========================================================\n            SECTION 6: BUDGET & REPORTS');
if (storeStartIdx === -1 || storeEndIdx === -1) {
    console.error('Could not find Store or Budget boundaries');
    process.exit(1);
}
const storeContent = content.substring(storeStartIdx, storeEndIdx);
content = content.substring(0, storeStartIdx) + content.substring(storeEndIdx);

// 3. Insert Store before Audit Log
const newAuditLogIdx = content.indexOf('{/* Sub-section: Audit Log */}');
content = content.substring(0, newAuditLogIdx) + storeContent + content.substring(newAuditLogIdx);

// 4. Update Initiatives Header
const initHeaderTarget = `{isManager && (
                <Button onClick={() => setInitiativeDialogOpen(true)} className="font-bold">
                  <PlusCircle className="h-4 w-4 me-1.5" />
                  {isRtl ? "إنشاء مبادرة جديدة" : "Create Initiative"}
                </Button>
                )}`;
const initHeaderReplacement = `<div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPointsDialogOpen(true)} className="font-bold border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10">
                    <Zap className="h-4 w-4 me-1.5" />
                    {isRtl ? "رصد سريع" : "Quick Points"}
                  </Button>
                  {isManager && (
                  <Button onClick={() => setInitiativeDialogOpen(true)} className="font-bold">
                    <PlusCircle className="h-4 w-4 me-1.5" />
                    {isRtl ? "إنشاء مبادرة جديدة" : "Create Initiative"}
                  </Button>
                  )}
                </div>`;
content = content.replace(initHeaderTarget, initHeaderReplacement);

// 5. Transform Quick Points into a Dialog and insert it
// We need to strip out the <Card> and <div className="space-y-4 border-t border-dashed pt-8"> wrappers, 
// but it's easier to just wrap the whole thing inside DialogContent and maybe remove borders.
// Actually, let's just create the Dialog structure and inject the CardContent part.

const cardContentStart = quickPointsContent.indexOf('<CardContent');
const cardContentEnd = quickPointsContent.indexOf('</CardContent>') + '</CardContent>'.length;
const cardContentOnly = quickPointsContent.substring(cardContentStart, cardContentEnd);

const quickPointsDialog = `
      {/* Quick Points Dialog */}
      <Dialog open={pointsDialogOpen} onOpenChange={setPointsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Star className="h-5 w-5 text-primary fill-current" />
              {isRtl ? "رصد نقاط يدوية سريعة" : "Quick Points Award"}
            </DialogTitle>
            <DialogDescription className="text-xs">{isRtl ? "رصد نقاط لفرد أو لمجموعة كاملة كحافز أسبوعي أو يومي" : "Award points to participants or groups"}</DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            ${cardContentOnly}
          </div>
        </DialogContent>
      </Dialog>
`;

const dialogsSectionIdx = content.indexOf('{/* Group Dialog */}');
content = content.substring(0, dialogsSectionIdx) + quickPointsDialog + content.substring(dialogsSectionIdx);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Rearrangement successful');
