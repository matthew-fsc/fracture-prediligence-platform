"""Company CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.ontology.models import Company

router = APIRouter()


@router.get("/")
def list_companies(db: Session = Depends(get_db)):
    return db.query(Company).all()


@router.get("/{company_id}")
def get_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.post("/")
def create_company(data: dict, db: Session = Depends(get_db)):
    company = Company(**data)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company
