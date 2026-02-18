"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

export default function PermissionsGuidePage() {
    return (
        <div className="p-8 space-y-8" dir="rtl">
            <h1 className="text-3xl font-bold">دليل صلاحيات النظام (Permissions Guide)</h1>

            <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 flex gap-3 text-sm">
                <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                <div>
                    <h5 className="font-medium mb-1">ملاحظة هامة</h5>
                    <p className="text-muted-foreground">
                        هذا الجدول يوضح القواعد المطبقة حالياً في نظام RFP لضبط الصلاحيات على Google Drive.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>جدول قواعد تطبيق الصلاحيات (Enforcement Rules)</CardTitle>
                    <CardDescription>آخر تحديث: فبراير 2026</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">الحالة (Scenario)</TableHead>
                                <TableHead className="text-right">الشرط (Condition)</TableHead>
                                <TableHead className="text-right">الإجراء (Action)</TableHead>
                                <TableHead className="text-right">النتيجة (Result)</TableHead>
                                <TableHead className="text-right">ملاحظات هامة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Row 1: Limited Access */}
                            <TableRow>
                                <TableCell className="font-medium">1. صلاحيات الـ Limited Access</TableCell>
                                <TableCell>Template <code>limitedAccess: true</code></TableCell>
                                <TableCell>يتم تفعيل Limited Access (<code>True</code>)</TableCell>
                                <TableCell><strong>إخفاء</strong> الصلاحيات الموروثة من الأب.</TableCell>
                                <TableCell>يتبقى فقط من تم إضافتهم يدوياً (Explicit).</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell></TableCell>
                                <TableCell>Template <code>limitedAccess: false</code></TableCell>
                                <TableCell>يتم تعطيل Limited Access (<code>False</code>)</TableCell>
                                <TableCell><strong>ظهور</strong> الصلاحيات الموروثة من الأب.</TableCell>
                                <TableCell>المستخدم يرث صلاحيات الأب + الصلاحيات المضافة.</TableCell>
                            </TableRow>

                            {/* Row 2: Add */}
                            <TableRow>
                                <TableCell className="font-medium">2. الإضافة (Groups/Users)</TableCell>
                                <TableCell>موجود في Template</TableCell>
                                <TableCell>يتم إضافة المستخدم/المجموعة</TableCell>
                                <TableCell><strong>تمت الإضافة</strong>.</TableCell>
                                <TableCell>يتم تطبيق الدور المحدد (مع مراعاة قاعدة 4 و 7).</TableCell>
                            </TableRow>

                            {/* Row 3: Remove */}
                            <TableRow>
                                <TableCell className="font-medium">3. الحذف (Unexpected)</TableCell>
                                <TableCell>غير موجود في Template</TableCell>
                                <TableCell>يتم حذف الصلاحية (Remove)</TableCell>
                                <TableCell><strong>تم الحذف</strong>.</TableCell>
                                <TableCell>يتم حذف أي شخص غير موجود في الـ Template.</TableCell>
                            </TableRow>

                            {/* Row 4: Roles */}
                            <TableRow>
                                <TableCell className="font-medium">4. تحويل الأدوار (Role Mapping)</TableCell>
                                <TableCell>الدور في Template هو <code>Manager</code></TableCell>
                                <TableCell>يتم تحويله تلقائياً</TableCell>
                                <TableCell><strong>Contributor (writer)</strong></TableCell>
                                <TableCell>قاعدة ثابتة: الكود يحول <code>Manager</code> و <code>Content Manager</code> إلى <code>Writer</code> دائماً.</TableCell>
                            </TableRow>

                            {/* Row 5: Protected */}
                            <TableRow>
                                <TableCell className="font-medium">5. الحماية (Protected)</TableCell>
                                <TableCell>الإيميل `mo.abuomar@dtgsa.com`</TableCell>
                                <TableCell>تجاهل الحذف</TableCell>
                                <TableCell><strong>بقاؤه كما هو</strong>.</TableCell>
                                <TableCell>محمي من الحذف دائماً.</TableCell>
                            </TableRow>

                            {/* Row 6: Inheritance */}
                            <TableRow>
                                <TableCell className="font-medium">6. الوراثة (Inheritance)</TableCell>
                                <TableCell>موروث من الأب</TableCell>
                                <TableCell>Limited Access <code>False</code></TableCell>
                                <TableCell><strong>يبقى كما هو</strong>.</TableCell>
                                <TableCell>لا يمكن حذفه إلا بتفعيل Limited Access.</TableCell>
                            </TableRow>

                            {/* Row 7: Upgrade Ceiling */}
                            <TableRow className="bg-yellow-50/50">
                                <TableCell className="font-medium">7. الترقية (Upgrade Ceiling)</TableCell>
                                <TableCell>Template Role {'>'} Parent Role</TableCell>
                                <TableCell>Limited Access <code>False</code></TableCell>
                                <TableCell><strong>يتم منع الترقية (Blocked)</strong>.</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-yellow-600 border-yellow-400">قاعدة جديدة</Badge>
                                    <br />
                                    إذا لم يكن Limited Access مفعلاً، لا يسمح بمنح صلاحية أعلى من الموروثة.
                                </TableCell>
                            </TableRow>

                            {/* Row 8: Downgrade */}
                            <TableRow>
                                <TableCell className="font-medium">8. التقليل (Downgrade)</TableCell>
                                <TableCell>Template Role {'<'} Parent Role</TableCell>
                                <TableCell>Limited Access <code>False</code></TableCell>
                                <TableCell><strong>يفشل التقليل</strong> (يبقى Role الأب).</TableCell>
                                <TableCell>لا يمكن تقليل الصلاحية عن الأب إلا بتفعيل Limited Access.</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
