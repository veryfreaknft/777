"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatTemplate = exports.TemplateType = void 0;
const typeorm_1 = require("typeorm");
var TemplateType;
(function (TemplateType) {
    TemplateType["STATIC"] = "static";
    TemplateType["AI_GENERATED"] = "ai_generated";
})(TemplateType || (exports.TemplateType = TemplateType = {}));
let ChatTemplate = class ChatTemplate {
    constructor() {
        this.type = TemplateType.STATIC;
        this.minDelay = 60;
        this.maxDelay = 300;
        this.enabled = true;
        this.aiConfig = null;
    }
};
exports.ChatTemplate = ChatTemplate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ChatTemplate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ChatTemplate.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'simple-enum',
        enum: TemplateType,
        default: TemplateType.STATIC
    }),
    __metadata("design:type", String)
], ChatTemplate.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ChatTemplate.prototype, "minDelay", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ChatTemplate.prototype, "maxDelay", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ChatTemplate.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], ChatTemplate.prototype, "aiConfig", void 0);
exports.ChatTemplate = ChatTemplate = __decorate([
    (0, typeorm_1.Entity)()
], ChatTemplate);
//# sourceMappingURL=ChatTemplate.js.map