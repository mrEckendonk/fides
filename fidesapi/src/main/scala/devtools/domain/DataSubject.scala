package devtools.domain

import devtools.domain.definition.{CanBeTree, OrganizationId, TreeItem, WithFidesKey}

import scala.collection.mutable

final case class DataSubject(
  id: Long,
  parentId: Option[Long],
  organizationId: Long,
  fidesKey: String,
  name: Option[String],
  parentKey: Option[String],
  description: Option[String]
) extends WithFidesKey[DataSubject, Long] with CanBeTree[Long, DataSubjectTree] with OrganizationId {
  override def withId(idValue: Long): DataSubject = this.copy(id = idValue)

  def toTreeItem: DataSubjectTree =
    DataSubjectTree(
      id,
      parentId,
      fidesKey,
      name,
      parentKey,
      new mutable.TreeSet[DataSubjectTree]()(Ordering.by[DataSubjectTree, Long](_.id))
    )
}

object DataSubject {
  type Tupled = (Long, Option[Long], Long, String, Option[String], Option[String], Option[String])
  def toInsertable(s: DataSubject): Option[Tupled] =
    Some(s.id, s.parentId, s.organizationId, s.fidesKey, s.name, s.parentKey, s.description)

  def fromInsertable(t: Tupled): DataSubject =
    new DataSubject(t._1, t._2, t._3, t._4, t._5, t._6, t._7)

}
final case class DataSubjectTree(
  id: Long,
  parentId: Option[Long],
  fidesKey: String,
  name: Option[String],
  parentKey: Option[String],
  children: mutable.Set[DataSubjectTree]
) extends TreeItem[DataSubjectTree, Long] {}
