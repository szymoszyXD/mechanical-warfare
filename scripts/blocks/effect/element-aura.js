const elib = require("mechanical-warfare/effectlib");
const plib = require("mechanical-warfare/plib");

/* Fire Aura effect */
const fireAuraEffect = newEffect(40, e => {
  Draw.color(plib.fireAuraFlame, Pal.darkFlame, e.fin());
  Angles.randLenVectors(e.id, 3, 2 + e.fin() * 9, new Floatc2(){get: (x, y) => {
	elib.fillCircleWCol(e.x + x, e.y + y, 0.2 + e.fout() * 1.5);
  }});
  Draw.color();
});

/* Fire Aura bullet */
const fireAuraBullet = extend(BasicBulletType, {
  draw(b){}
});
fireAuraBullet.speed = 0.001;
fireAuraBullet.lifetime = 1;
fireAuraBullet.damage = 1;
fireAuraBullet.status = StatusEffects.melting;
fireAuraBullet.hitEffect = Fx.none;
fireAuraBullet.despawnEffect = Fx.none;

/* Fire Aura */
const fireAura = extendContent(PowerTurret, "fire-aura", {
  init(){
	this.super$init();
	this.consumes.remove(ConsumeType.liquid);
  },
  load(){
    this.super$load();
    this.region = Core.atlas.find(this.name);
	this.heatRegion = Core.atlas.find(this.name + "-heat");
    this.liquidRegion = Core.atlas.find(this.name + "-liquid");
  },
  generateIcons: function(){
	  return [
		Core.atlas.find(this.name)
	  ];
  },
  update(tile){
    var entity = tile.ent();
    if(!this.validateTarget(tile)){
      entity.target = null;
    }
    entity.recoil = 0;
    entity.rotation = 90;
    var isShooting = this.hasAmmo(tile) && this.validateTarget(tile);
    entity.heat = Mathf.lerpDelta(entity.heat,
      isShooting ? 1 : 0,
      isShooting ? this.warmup : this.cooldown
    );
    if(this.hasAmmo(tile)){
      if(entity.timer.get(this.timerTarget, this.targetInterval)){
        this.findTarget(tile);
      }
      if(this.validateTarget(tile)){
        this.updateShooting(tile);
      }
    }
  },
  draw(tile){
    var entity = tile.ent();
	Draw.rect(this.region, tile.drawx(), tile.drawy());
    Draw.color(entity.liquids.current().color);
    Draw.alpha(entity.liquids.total() / this.liquidCapacity);
    Draw.rect(this.liquidRegion, tile.drawx(), tile.drawy());
    Draw.color();
  },
  drawLayer(tile){
	  var entity = tile.ent();
	  Draw.color(Color.black, this.heatColor, entity.heat * 0.7 + Mathf.absin(Time.time(), 3, 0.3) * entity.heat);
	  Draw.blend(Blending.additive);
	  Draw.rect(this.heatRegion, tile.drawx(), tile.drawy());
	  Draw.blend();
	  Draw.color();
  },
  updateShooting(tile){
    var entity = tile.ent();
    if(entity.reload >= this.reload){
      var type = this.peekAmmo(tile);
      this.shoot(tile, type);
      entity.reload = 0;
    }else{
      entity.reload += tile.entity.delta() * (this.peekAmmo(tile)).reloadMultiplier * this.baseReloadSpeed(tile);
    }
  },
  shoot(tile, type){
    var entity = tile.ent();
    var radius = this.range;
    var hasShot = false;
    Units.nearbyEnemies(tile.getTeam(), tile.drawx() - radius, tile.drawy() - radius, radius * 2, radius * 2, cons(unit => {
      if(unit.withinDst(tile.drawx(), tile.drawy(), radius)){
        if(!unit.isDead() && unit instanceof HealthTrait){
		  Bullet.create(type, tile.entity, tile.getTeam(), unit.x, unit.y, 0, 1, 1);
          if(!hasShot){
            hasShot = true;
            this.effects(tile);
            this.effectsArea(tile, this.areaEffectCount);
            this.useAmmo(tile);
          }
        }
      }
    }));
  },
  effects(tile){
    var shootEffect = this.shootEffect == Fx.none ? (this.peekAmmo(tile)).shootEffect : this.shootEffect;
    var smokeEffect = this.smokeEffect == Fx.none ? (this.peekAmmo(tile)).smokeEffect : this.smokeEffect;
    var entity = tile.ent();
    Effects.effect(shootEffect, tile.drawx(), tile.drawy(), entity.rotation);
    Effects.effect(smokeEffect, tile.drawx(), tile.drawy(), entity.rotation);
  },
  effectsArea(tile, count){
    var shootEffect = this.shootEffect == Fx.none ? (this.peekAmmo(tile)).shootEffect : this.shootEffect;
    var smokeEffect = this.smokeEffect == Fx.none ? (this.peekAmmo(tile)).smokeEffect : this.smokeEffect;
    var entity = tile.ent();
    for (var i = 0; i < count; i++){
      Effects.effect(shootEffect,
        tile.drawx() + Angles.trnsx(Mathf.random(360), Mathf.random(this.range)),
        tile.drawy() + Angles.trnsy(Mathf.random(360), Mathf.random(this.range)),
        entity.rotation
      );
      Effects.effect(smokeEffect,
        tile.drawx() + Angles.trnsx(Mathf.random(360), Mathf.random(this.range)),
        tile.drawy() + Angles.trnsy(Mathf.random(360), Mathf.random(this.range)),
        entity.rotation
      );
    }
  },
  findTarget(tile){
	var entity = tile.ent();
	entity.target = Units.closestEnemy(tile.getTeam(), tile.drawx(), tile.drawy(), this.range, boolf(e => !e.isDead()));
  },
  setStats(){
    this.super$setStats();
    this.stats.remove(BlockStat.booster);
    this.stats.add(BlockStat.input, new LiquidValue(this.liquidAsAmmo(), this.shootType.ammoMultiplier * 60 / this.reload, true));
  },
  useAmmo: function(tile){
    var entity = tile.ent();
    if(tile.isEnemyCheat()){
      return this.shootType;
    }
    var type = this.shootType;
    entity.liquids.remove(entity.liquids.current(), type.ammoMultiplier);
    return type;
  },
  acceptItem: function(item, tile, source){
    return false;
  },
  acceptLiquid: function(tile, source, liquid, amount){
    return this.liquidAsAmmo() == liquid || tile.entity.liquids.current() == liquid && tile.entity.liquids.get(tile.entity.liquids.current()) <= this.shootType.ammoMultiplier + 0.001;
  },
  hasAmmo: function(tile){
    var entity = tile.ent();
    return entity.cons.valid() && this.liquidAsAmmo() == entity.liquids.current() && entity.liquids.total() >= this.shootType.ammoMultiplier;
  },
  shouldActiveSound: function(tile){
    var entity = tile.ent();
    return tile != null && this.hasAmmo(tile) && this.validateTarget(tile);
  },
  shouldTurn: function(tile){
    return false;
  },
  liquidAsAmmo: function(){
    return Vars.content.getByName(ContentType.liquid, this.liquidAmmoName);
  },
});
fireAura.reload = 5;
fireAura.shootType = fireAuraBullet;
fireAura.range = 15 * Vars.tilesize;
fireAura.areaEffectCount = 3;
fireAura.hasItems = false;
fireAura.hasLiquids = true;
fireAura.liquidAmmoName = "mechanical-warfare-liquid-lava";
fireAura.liquidCapacity = 60;
fireAura.shootEffect = fireAuraEffect;
fireAura.smokeEffect = Fx.fireSmoke;
fireAura.ammoUseEffect = Fx.none;
fireAura.targetInterval = 5;
fireAura.warmup = 0.08;

/* Frost Aura effect */
const frostAuraEffect = newEffect(40, e => {
	e.scaled(1.3, cons(i => {
		elib.splashCircles(e.x, e.y, Pal.lancerLaser, 1, i.fout() * 3.2, e.fin() * 7, 2, e.id);
	}));
	elib.splashCircles(e.x, e.y, plib.frostAuraIce, 1, e.fout() * 0.8, 1 + e.fin() * 14, 4, e.id);
});

const frostAuraSmoke = newEffect(35, e => {
	elib.splashCircles(e.x, e.y, Color.lightGray, 1, 0.2 + e.fslope() * 0.8, 2 + e.fin() * 7, 1, e.id);
});

/* Frost Aura bullet */
const frostAuraBullet = extend(BasicBulletType, {
  draw(b){}
});
frostAuraBullet.speed = 0.001;
frostAuraBullet.lifetime = 1;
frostAuraBullet.damage = 1;
frostAuraBullet.status = StatusEffects.freezing;
frostAuraBullet.hitEffect = Fx.none;
frostAuraBullet.despawnEffect = Fx.none;

/* Frost Aura */
const frostAura = extendContent(PowerTurret, "frost-aura", {
  init(){
	this.super$init();
	this.consumes.remove(ConsumeType.liquid);
  },
  load(){
    this.super$load();
    this.region = Core.atlas.find(this.name);
	this.heatRegion = Core.atlas.find(this.name + "-heat");
    this.liquidRegion = Core.atlas.find(this.name + "-liquid");
  },
  generateIcons: function(){
	  return [
		Core.atlas.find(this.name)
	  ];
  },
  update(tile){
    var entity = tile.ent();
    if(!this.validateTarget(tile)){
      entity.target = null;
    }
    entity.recoil = 0;
    entity.rotation = 90;
    var isShooting = this.hasAmmo(tile) && this.validateTarget(tile);
    entity.heat = Mathf.lerpDelta(entity.heat,
      isShooting ? 1 : 0,
      isShooting ? this.warmup : this.cooldown
    );
    if(this.hasAmmo(tile)){
      if(entity.timer.get(this.timerTarget, this.targetInterval)){
        this.findTarget(tile);
      }
      if(this.validateTarget(tile)){
        this.updateShooting(tile);
      }
    }
  },
  draw(tile){
    var entity = tile.ent();
	Draw.rect(this.region, tile.drawx(), tile.drawy());
    Draw.color(entity.liquids.current().color);
    Draw.alpha(entity.liquids.total() / this.liquidCapacity);
    Draw.rect(this.liquidRegion, tile.drawx(), tile.drawy());
    Draw.color();
  },
  drawLayer(tile){
	  var entity = tile.ent();
	  Draw.color(Color.black, entity.liquids.current().color, (entity.heat * 0.5 + Mathf.absin(Time.time(), 3, 0.5) * entity.heat) * 0.6);
	  Draw.blend(Blending.additive);
	  Draw.rect(this.heatRegion, tile.drawx(), tile.drawy());
	  Draw.blend();
	  Draw.color();
  },
  updateShooting(tile){
    var entity = tile.ent();
    if(entity.reload >= this.reload){
      var type = this.peekAmmo(tile);
      this.shoot(tile, type);
      entity.reload = 0;
    }else{
      entity.reload += tile.entity.delta() * (this.peekAmmo(tile)).reloadMultiplier * this.baseReloadSpeed(tile);
    }
  },
  shoot(tile, type){
    var entity = tile.ent();
    var radius = this.range;
    var hasShot = false;
    Units.nearbyEnemies(tile.getTeam(), tile.drawx() - radius, tile.drawy() - radius, radius * 2, radius * 2, cons(unit => {
      if(unit.withinDst(tile.drawx(), tile.drawy(), radius)){
        if(!unit.isDead() && unit instanceof HealthTrait){
		  Bullet.create(type, tile.entity, tile.getTeam(), unit.x, unit.y, 0, 1, 1);
          if(!hasShot){
            hasShot = true;
            this.effects(tile);
            this.effectsArea(tile, this.areaEffectCount);
            this.useAmmo(tile);
          }
        }
      }
    }));
  },
  effects(tile){
    var shootEffect = this.shootEffect == Fx.none ? (this.peekAmmo(tile)).shootEffect : this.shootEffect;
    var smokeEffect = this.smokeEffect == Fx.none ? (this.peekAmmo(tile)).smokeEffect : this.smokeEffect;
    var entity = tile.ent();
    Effects.effect(shootEffect, tile.drawx(), tile.drawy(), entity.rotation);
    Effects.effect(smokeEffect, tile.drawx(), tile.drawy(), entity.rotation);
  },
  effectsArea(tile, count){
    var shootEffect = this.shootEffect == Fx.none ? (this.peekAmmo(tile)).shootEffect : this.shootEffect;
    var smokeEffect = this.smokeEffect == Fx.none ? (this.peekAmmo(tile)).smokeEffect : this.smokeEffect;
    var entity = tile.ent();
    for (var i = 0; i < count; i++){
      Effects.effect(shootEffect,
        tile.drawx() + Angles.trnsx(Mathf.random(360), Mathf.random(this.range)),
        tile.drawy() + Angles.trnsy(Mathf.random(360), Mathf.random(this.range)),
        entity.rotation
      );
      Effects.effect(smokeEffect,
        tile.drawx() + Angles.trnsx(Mathf.random(360), Mathf.random(this.range)),
        tile.drawy() + Angles.trnsy(Mathf.random(360), Mathf.random(this.range)),
        entity.rotation
      );
    }
  },
  findTarget(tile){
	var entity = tile.ent();
	entity.target = Units.closestEnemy(tile.getTeam(), tile.drawx(), tile.drawy(), this.range, boolf(e => !e.isDead()));
  },
  setStats(){
    this.super$setStats();
    this.stats.remove(BlockStat.booster);
    this.stats.add(BlockStat.input, new LiquidValue(this.liquidAsAmmo(), this.shootType.ammoMultiplier * 60 / this.reload, true));
  },
  useAmmo: function(tile){
    var entity = tile.ent();
    if(tile.isEnemyCheat()){
      return this.shootType;
    }
    var type = this.shootType;
    entity.liquids.remove(entity.liquids.current(), type.ammoMultiplier);
    return type;
  },
  acceptItem: function(item, tile, source){
    return false;
  },
  acceptLiquid: function(tile, source, liquid, amount){
    return this.liquidAsAmmo() == liquid || tile.entity.liquids.current() == liquid && tile.entity.liquids.get(tile.entity.liquids.current()) <= this.shootType.ammoMultiplier + 0.001;
  },
  hasAmmo: function(tile){
    var entity = tile.ent();
    return entity.cons.valid() && this.liquidAsAmmo() == entity.liquids.current() && entity.liquids.total() >= this.shootType.ammoMultiplier;
  },
  shouldActiveSound: function(tile){
    var entity = tile.ent();
    return tile != null && this.hasAmmo(tile) && this.validateTarget(tile);
  },
  shouldTurn: function(tile){
    return false;
  },
  liquidAsAmmo: function(){
    return Liquids.cryofluid;
  },
});
frostAura.reload = 5;
frostAura.shootType = frostAuraBullet;
frostAura.range = 17.5 * Vars.tilesize;
frostAura.areaEffectCount = 3;
frostAura.hasItems = false;
frostAura.hasLiquids = true;
frostAura.liquidCapacity = 60;
frostAura.shootEffect = frostAuraEffect;
frostAura.smokeEffect = frostAuraSmoke;
frostAura.ammoUseEffect = Fx.none;
frostAura.targetInterval = 5;
frostAura.warmup = 0.08;
